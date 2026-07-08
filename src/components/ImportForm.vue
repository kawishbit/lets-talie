<script setup lang="ts">
	import { computed, ref } from "vue";

	interface ParsedRow {
		_rowNum: number;
		name?: string;
		date?: string;
		remarks?: string;
		amount?: string;
		paidByUserId?: string;
		type?: string;
		status?: string;
		categoryId?: string;
		transactionGroupId?: string;
		createdAt?: string;
		[key: string]: unknown;
	}

	interface RowError {
		row: number;
		errors: string[];
	}

	const fileInput = ref<HTMLInputElement | null>(null);
	const parsedRows = ref<ParsedRow[]>([]);
	const rowErrors = ref<RowError[]>([]);
	const parseError = ref("");
	const loading = ref(false);
	const success = ref(false);
	const submitError = ref("");

	const hasErrors = computed(
		() => rowErrors.value.length > 0 || parseError.value !== "",
	);
	const canSubmit = computed(
		() => parsedRows.value.length > 0 && !hasErrors.value && !loading.value,
	);

	function parseCsv(text: string): Record<string, string>[] {
		const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
		if (lines.length < 2) return [];
		const headers = lines[0]
			.split(",")
			.map((h) => h.trim().replace(/^"|"$/g, ""));
		return lines.slice(1).map((line) => {
			const values = line.match(/(".*?"|[^,]+)(?=,|$)/g) ?? [];
			const record: Record<string, string> = {};
			headers.forEach((h, i) => {
				record[h] = (values[i] ?? "").trim().replace(/^"|"$/g, "");
			});
			return record;
		});
	}

	function clientValidateRow(row: ParsedRow): string[] {
		const errors: string[] = [];
		if (!row.name || String(row.name).trim().length === 0) {
			errors.push("name is required");
		}
		if (!row.date || Number.isNaN(new Date(row.date).getTime())) {
			errors.push("date must be a valid date");
		}
		const amount = parseFloat(String(row.amount ?? ""));
		if (Number.isNaN(amount) || amount <= 0) {
			errors.push("amount must be a positive number");
		}
		if (!row.paidByUserId || String(row.paidByUserId).trim().length === 0) {
			errors.push("paidByUserId is required");
		}
		if (!["deposit", "withdrawal"].includes(String(row.type ?? ""))) {
			errors.push('type must be "deposit" or "withdrawal"');
		}
		if (
			!["pending", "completed", "cancelled"].includes(String(row.status ?? ""))
		) {
			errors.push('status must be "pending", "completed", or "cancelled"');
		}
		return errors;
	}

	function errorsForRow(rowNum: number): string[] {
		return rowErrors.value.find((e) => e.row === rowNum)?.errors ?? [];
	}

	async function handleFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			parsedRows.value = [];
			rowErrors.value = [];
			parseError.value = "";
			return;
		}

		parseError.value = "";
		rowErrors.value = [];
		parsedRows.value = [];
		submitError.value = "";

		const text = await file.text();
		let rows: ParsedRow[];

		if (file.name.endsWith(".json") || file.type === "application/json") {
			try {
				const parsed = JSON.parse(text);
				if (!Array.isArray(parsed)) {
					parseError.value = "JSON file must be an array of transaction rows.";
					return;
				}
				rows = (parsed as Record<string, unknown>[]).map((r, i) => ({
					...r,
					_rowNum: i + 1,
				})) as ParsedRow[];
			} catch {
				parseError.value =
					"Failed to parse JSON file. Please check the format.";
				return;
			}
		} else if (file.name.endsWith(".csv") || file.type === "text/csv") {
			const csvRows = parseCsv(text);
			if (csvRows.length === 0) {
				parseError.value = "CSV file is empty or missing a header row.";
				return;
			}
			rows = csvRows.map((r, i) => ({ ...r, _rowNum: i + 1 })) as ParsedRow[];
		} else {
			parseError.value = "Please upload a .csv or .json file.";
			return;
		}

		// Client-side validation
		const errors: RowError[] = [];
		for (const row of rows) {
			const errs = clientValidateRow(row);
			if (errs.length > 0) {
				errors.push({ row: row._rowNum, errors: errs });
			}
		}

		parsedRows.value = rows;
		rowErrors.value = errors;
	}

	async function handleSubmit() {
		if (!canSubmit.value || !fileInput.value?.files?.[0]) return;
		loading.value = true;
		submitError.value = "";

		try {
			const file = fileInput.value.files[0];
			const formData = new FormData();
			formData.append("file", file);

			const res = await fetch("/api/transactions/import", {
				method: "POST",
				body: formData,
			});

			const data = await res.json();

			if (!res.ok) {
				if (data.rowErrors) {
					rowErrors.value = data.rowErrors;
					submitError.value =
						"Some rows have validation errors. Please fix them and re-upload.";
				} else {
					submitError.value = data.error ?? "Import failed.";
				}
				return;
			}

			success.value = true;
			setTimeout(() => {
				success.value = false;
				parsedRows.value = [];
				rowErrors.value = [];
				parseError.value = "";
				if (fileInput.value) fileInput.value.value = "";
			}, 2500);
		} catch {
			submitError.value = "Network error. Please try again.";
		} finally {
			loading.value = false;
		}
	}

	const columns = [
		"name",
		"date",
		"amount",
		"paidByUserId",
		"type",
		"status",
		"remarks",
		"categoryId",
		"transactionGroupId",
		"createdAt",
	] as const;
</script>

<template>
	<div
		v-if="success"
		class="bg-(--color-block-lime) rounded-2xl px-6 py-8 text-center"
	>
		<p class="text-lg font-medium tracking-[-0.01em]">Import successful!</p>
		<p class="text-sm text-muted mt-1">
			{{ parsedRows.length }}
			transaction{{ parsedRows.length === 1 ? '' : 's' }}
			imported.
		</p>
	</div>

	<div v-else>
		<!-- File input -->
		<div class="mb-6">
			<label
				for="file-upload"
				class="block text-xs font-medium uppercase tracking-wider text-label mb-2"
			>
				Upload file
			</label>
			<input
				id="file-upload"
				ref="fileInput"
				type="file"
				accept=".csv,.json,text/csv,application/json"
				@change="handleFileChange"
				class="block w-full text-sm text-label
          file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0
          file:text-sm file:font-[480] file:bg-ink file:text-(--color-canvas)
          hover:file:opacity-80 file:cursor-pointer file:transition-opacity"
			>
			<p class="mt-2 text-xs text-muted">
				Accepted formats:
				<code class="font-mono bg-surface px-1 py-0.5 rounded">.csv</code>
				or
				<code class="font-mono bg-surface px-1 py-0.5 rounded">.json</code>.
				Required fields: <code class="font-mono">name</code>,
				<code class="font-mono">date</code>,
				<code class="font-mono">amount</code>,
				<code class="font-mono">paidByUserId</code>,
				<code class="font-mono">type</code>,
				<code class="font-mono">status</code>.
			</p>
		</div>

		<!-- Parse error -->
		<div
			v-if="parseError"
			class="bg-error-bg border border-error-border rounded-xl px-4 py-3 text-sm text-error-text mb-6"
		>
			{{ parseError }}
		</div>

		<!-- Preview table -->
		<div v-if="parsedRows.length > 0" class="mb-6">
			<div class="flex items-center justify-between mb-3">
				<p class="text-sm font-medium">
					Preview —
					{{ parsedRows.length }}
					row{{ parsedRows.length === 1 ? '' : 's' }}
					<span v-if="rowErrors.length > 0" class="ml-2 text-red-600">
						({{ rowErrors.length }}
						with errors)
					</span>
				</p>
			</div>

			<div class="border border-hairline rounded-2xl overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full text-xs">
						<thead>
							<tr class="border-b border-hairline bg-surface">
								<th
									class="text-left px-3 py-2.5 font-medium text-label uppercase tracking-wider"
								>
									#
								</th>
								<th
									v-for="col in columns"
									:key="col"
									class="text-left px-3 py-2.5 font-medium text-label uppercase tracking-wider"
								>
									{{ col }}
								</th>
								<th
									class="text-left px-3 py-2.5 font-medium text-label uppercase tracking-wider"
								>
									Errors
								</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="row in parsedRows"
								:key="row._rowNum"
								:class="[
                  'border-b border-hairline last:border-0',
                  errorsForRow(row._rowNum).length > 0 ? 'bg-error-bg' : '',
                ]"
							>
								<td class="px-3 py-2 text-subtle">
									{{ row._rowNum }}
								</td>
								<td
									v-for="col in columns"
									:key="col"
									class="px-3 py-2 max-w-30 truncate"
								>
									<span v-if="row[col] !== undefined && row[col] !== ''"
										>{{ row[col] }}</span
									>
									<span v-else class="text-subtle">—</span>
								</td>
								<td class="px-3 py-2">
									<ul
										v-if="errorsForRow(row._rowNum).length > 0"
										class="text-red-600 space-y-0.5"
									>
										<li v-for="err in errorsForRow(row._rowNum)" :key="err">
											{{ err }}
										</li>
									</ul>
									<span v-else class="text-badge-positive-text">✓</span>
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</div>
		</div>

		<!-- Submit error -->
		<div
			v-if="submitError"
			class="bg-error-bg border border-error-border rounded-xl px-4 py-3 text-sm text-error-text mb-4"
		>
			{{ submitError }}
		</div>

		<!-- Submit -->
		<button
			type="button"
			:disabled="!canSubmit"
			@click="handleSubmit"
			:class="[
        'inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-[480] tracking-[-0.01em] transition-opacity',
        canSubmit
          ? 'bg-ink text-(--color-canvas) hover:opacity-80 cursor-pointer'
          : 'bg-hairline text-subtle cursor-not-allowed',
      ]"
		>
			<svg
				v-if="loading"
				class="w-4 h-4 animate-spin"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				aria-hidden="true"
			>
				<circle
					class="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					stroke-width="4"
				/>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8v8H4z"
				/>
			</svg>
			{{ loading ? 'Importing…' : parsedRows.length > 0 ? `Import ${parsedRows.length} transaction${parsedRows.length === 1 ? '' : 's'}` : 'Import' }}
		</button>
	</div>
</template>
