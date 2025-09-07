import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';

export const GET: RequestHandler = async () => {
	try {
		// Query the database to get wallet addresses - optimized for speed
		const result = await queryDatabase(
			`SELECT address FROM accounts WHERE balance != 0 ORDER BY balance DESC LIMIT 10`
		);

		// Create a mapping of likely wallet names to addresses based on patterns or balance
		const walletMappings: Record<string, string> = {};
		
		// For now, we'll use a simple approach - map known addresses to wallet names
		// This could be enhanced by storing wallet names in the database or using other heuristics
		const knownWalletAddresses = {
			'tzei1qp9865tfwj4jkn0wcacg8j48w9xdyjg3fyzqgxux': 'alan',
			'tzei1qzzet7jr6ppfa004aupa9cyzjmlnyytzlys74ec9': 'alice',
			'tzei1qzhrhfgcdpz4gldle6zlk0q8kcd2elhfwumf0ejs': 'bob'
		};

		// Build the reverse mapping (wallet name -> address)
		for (const account of result) {
			const walletName = knownWalletAddresses[account.address];
			if (walletName) {
				walletMappings[walletName] = account.address;
			}
		}

		return json({
			success: true,
			walletAddresses: walletMappings
		});

	} catch (error) {
		console.error('Wallet address mapping error:', error);
		return json(
			{ error: 'Failed to get wallet addresses' },
			{ status: 500 }
		);
	}
};

async function queryDatabase(query: string): Promise<any[]> {
	return new Promise((resolve, reject) => {
		const psql = spawn('psql', [
			'-h', 'localhost',
			'-U', 'zeicoin',
			'-d', 'zeicoin_testnet',
			'-t', // tuple-only output
			'-A', // unaligned output
			'-q', // quiet mode for faster execution
			'-c', query
		], {
			env: {
				...process.env,
				ZEICOIN_DB_PASSWORD: 'testpass'
			}
		});

		let stdout = '';
		let stderr = '';

		psql.stdout.on('data', (data) => {
			stdout += data.toString();
		});

		psql.stderr.on('data', (data) => {
			stderr += data.toString();
		});

		psql.on('close', (code) => {
			if (code !== 0) {
				reject(new Error(`psql process exited with code ${code}: ${stderr}`));
				return;
			}

			try {
				// Parse the pipe-separated output - optimized for address only
				const lines = stdout.trim().split('\n').filter(line => line.trim());
				const results = lines.map(line => {
					const address = line.trim();
					return {
						address: address || null
					};
				});
				
				resolve(results);
			} catch (parseError) {
				reject(new Error(`Failed to parse database output: ${parseError}`));
			}
		});

		psql.stdin.write(query + '\n');
		psql.stdin.end();
	});
}