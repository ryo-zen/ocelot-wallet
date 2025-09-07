import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';

export const GET: RequestHandler = async ({ params }) => {
	const { address } = params;

	if (!address) {
		return json({ error: 'Address parameter is required' }, { status: 400 });
	}

	try {
		// Escape the address parameter for SQL safety
		const escapedAddress = address.replace(/'/g, "''");
		
		// Query the database using psql command - optimized for speed
		const result = await queryDatabase(
			`SELECT address, balance FROM accounts WHERE address = '${escapedAddress}'`
		);

		if (result.length === 0) {
			return json({ error: 'Account not found' }, { status: 404 });
		}

		const account = result[0];

		return json({
			success: true,
			account: {
				address: account.address,
				balance: account.balance?.toString() || '0'
			}
		});
	} catch (error) {
		console.error('Database query error:', error);
		return json(
			{ error: 'Failed to query database' },
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
				// Parse the pipe-separated output - optimized for minimal columns
				const lines = stdout.trim().split('\n').filter(line => line.trim());
				const results = lines.map(line => {
					const fields = line.split('|');
					return {
						address: fields[0] || null,
						balance: fields[1] ? BigInt(fields[1]) : null
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