function parseCsvLine(line: string): string[] {
	const values: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (inQuotes) {
			if (char === '"') {
				if (line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += char;
			}
		} else if (char === '"') {
			inQuotes = true;
		} else if (char === ",") {
			values.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	values.push(current);

	return values;
}

export function parseCsv(text: string): Record<string, string>[] {
	const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
	if (lines.length < 2) return [];

	const headers = parseCsvLine(lines[0]).map((h) => h.trim());

	return lines.slice(1).map((line) => {
		const values = parseCsvLine(line);
		const record: Record<string, string> = {};
		headers.forEach((h, i) => {
			record[h] = (values[i] ?? "").trim();
		});
		return record;
	});
}
