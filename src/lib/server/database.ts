import { spawn } from 'child_process';
import { dbConfig } from '$lib/config/env.js';

export async function queryDatabase(query: string): Promise<any[]> {
	return new Promise((resolve, reject) => {
		const psql = spawn('psql', [
			'-h', dbConfig.host,
			'-p', dbConfig.port.toString(),
			'-U', dbConfig.user,
			'-d', dbConfig.database,
			'-t', // tuple-only output
			'-A', // unaligned output
			'-q', // quiet mode for faster execution
			'-c', query
		], {
			env: {
				...process.env,
				PGPASSWORD: dbConfig.password
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

export async function queryDatabaseWithFields(query: string, fieldSeparator: string = '|'): Promise<any[]> {
	return new Promise((resolve, reject) => {
		const psql = spawn('psql', [
			'-h', dbConfig.host,
			'-p', dbConfig.port.toString(),
			'-U', dbConfig.user,
			'-d', dbConfig.database,
			'-t', // tuple-only output
			'-A', // unaligned output
			'-F', fieldSeparator, // field separator
			'-q', // quiet mode for faster execution
			'-c', query
		], {
			env: {
				...process.env,
				PGPASSWORD: dbConfig.password
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
				// Parse the pipe-separated output - this will be customized by each endpoint
				const lines = stdout.trim().split('\n').filter(line => line.trim());
				resolve(lines);
			} catch (parseError) {
				reject(new Error(`Failed to parse database output: ${parseError}`));
			}
		});

		psql.stdin.write(query + '\n');
		psql.stdin.end();
	});
}