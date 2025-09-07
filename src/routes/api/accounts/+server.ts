import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { spawn } from 'child_process';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const limit = url.searchParams.get('limit') || '10';
		const offset = url.searchParams.get('offset') || '0';

		// Query the database for all accounts
		const result = await queryDatabase(
			`SELECT address, balance, nonce, tx_count, last_active_time FROM accounts ORDER BY balance DESC LIMIT ${limit} OFFSET ${offset}`
		);

		return json({
			success: true,
			accounts: result.map(account => ({
				address: account.address,
				balance: account.balance?.toString() || '0',
				nonce: account.nonce?.toString() || '0',
				tx_count: account.tx_count || 0,
				last_active_time: account.last_active_time
			}))
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
			'-F', '|', // field separator
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
				// Parse the pipe-separated output
				const lines = stdout.trim().split('\n').filter(line => line.trim());
				const results = lines.map(line => {
					const fields = line.split('|');
					return {
						address: fields[0] || null,
						balance: fields[1] ? BigInt(fields[1]) : null,
						nonce: fields[2] ? BigInt(fields[2]) : null,
						tx_count: fields[3] ? parseInt(fields[3]) : null,
						last_active_time: fields[4] || null
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