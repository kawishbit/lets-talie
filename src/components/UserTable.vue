<script setup lang="ts">
	import { formatDate } from "@utils/date.ts";
	import { ref } from "vue";
	import { useServerTable } from "../composables/useServerTable";
	import DataTable from "./DataTable.vue";
	import UserFormModal from "./UserFormModal.vue";

	interface User {
		id: string;
		name: string;
		email: string;
		role: "user" | "admin";
		accountBalance: string;
		createdAt: string;
		deletedAt: string | null;
	}

	const props = defineProps<{
		initialUsers: User[];
		initialTotal: number;
		initialPage: number;
		pageSize: number;
		currentUserId: string;
	}>();

	const roleFilter = ref<"" | "user" | "admin">("");
	const showModal = ref(false);
	const editingUser = ref<User | null>(null);

	const {
		items: users,
		total,
		page,
		loading,
		error,
		totalPages,
		load,
	} = useServerTable<User>({
		pageSize: props.pageSize,
		initialItems: props.initialUsers,
		initialTotal: props.initialTotal,
		initialPage: props.initialPage,
		fetchFn: async (p) => {
			const params = new URLSearchParams({
				page: String(p),
				pageSize: String(props.pageSize),
			});
			if (roleFilter.value) params.set("role", roleFilter.value);
			const res = await fetch(`/api/users?${params}`);
			if (!res.ok) throw new Error("Failed to fetch users");
			return res.json();
		},
	});

	function openCreate() {
		editingUser.value = null;
		showModal.value = true;
	}

	function openEdit(u: User) {
		editingUser.value = u;
		showModal.value = true;
	}

	function closeModal() {
		showModal.value = false;
		editingUser.value = null;
	}

	async function onSaved() {
		closeModal();
		await load(page.value);
	}

	async function deleteUser(u: User) {
		if (!confirm(`Delete ${u.name}? This cannot be undone.`)) return;
		try {
			const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
			if (!res.ok) {
				const data = await res.json();
				alert(data.error ?? "Failed to delete user.");
				return;
			}
			await load(page.value);
		} catch {
			alert("Network error. Please try again.");
		}
	}

	function formatBalance(raw: string) {
		const n = parseFloat(raw ?? "0");
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: import.meta.env.PUBLIC_CURRENCY_CODE ?? "USD",
			signDisplay: "always",
		}).format(n);
	}
</script>

<template>
	<DataTable
		:loading="loading"
		:error="error"
		:page="page"
		:total-pages="totalPages"
		:total="total"
		:col-span="6"
		empty-text="No users found."
		item-label="user"
		@paginate="load"
	>
		<template #toolbar>
			<div
				class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"
			>
				<div class="flex items-center gap-2">
					<select
						v-model="roleFilter"
						@change="load(1)"
						class="px-3 py-2 rounded-xl border border-hairline text-sm outline-none focus:border-ink transition-colors bg-(--color-input-bg)"
					>
						<option value="">All roles</option>
						<option value="user">User</option>
						<option value="admin">Admin</option>
					</select>
				</div>
				<button
					type="button"
					@click="openCreate"
					class="inline-flex items-center gap-1.5 bg-ink text-(--color-canvas) px-4 py-2 rounded-full text-sm font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity cursor-pointer"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="w-4 h-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<line x1="12" y1="5" x2="12" y2="19" />
						<line x1="5" y1="12" x2="19" y2="12" />
					</svg>
					Add user
				</button>
			</div>
		</template>

		<template #head>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider"
			>
				Name
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider hidden sm:table-cell"
			>
				Email
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider"
			>
				Role
			</th>
			<th
				class="text-right px-4 py-3 font-medium text-label text-xs uppercase tracking-wider hidden md:table-cell"
			>
				Balance
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider hidden lg:table-cell"
			>
				Joined
			</th>
			<th class="px-4 py-3" />
		</template>

		<template #body>
			<tr
				v-for="u in users"
				:key="u.id"
				class="border-b border-hairline last:border-0 hover:bg-faint transition-colors"
			>
				<td class="px-4 py-3 font-[450]">{{ u.name }}</td>
				<td class="px-4 py-3 text-label hidden sm:table-cell">
					{{ u.email }}
				</td>
				<td class="px-4 py-3">
					<span
						:class="[
							'inline-block px-2 py-0.5 rounded-full text-xs font-medium',
							u.role === 'admin'
								? 'bg-ink text-(--color-canvas)'
								: 'bg-surface text-label',
						]"
						>{{ u.role }}</span
					>
				</td>
				<td class="px-4 py-3 text-right hidden md:table-cell">
					<span
						:class="parseFloat(u.accountBalance ?? '0') >= 0 ? 'text-green-700' : 'text-red-600'"
					>
						{{ formatBalance(u.accountBalance) }}
					</span>
				</td>
				<td class="px-4 py-3 text-muted hidden lg:table-cell">
					{{ formatDate(u.createdAt) }}
				</td>
				<td class="px-4 py-3">
					<div class="flex items-center justify-end gap-1">
						<button
							type="button"
							@click="openEdit(u)"
							class="p-1.5 rounded-full hover:bg-surface transition-colors text-label hover:text-ink cursor-pointer"
							title="Edit"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path
									d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
								/>
								<path
									d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
								/>
							</svg>
						</button>
						<button
							v-if="u.id !== currentUserId"
							type="button"
							@click="deleteUser(u)"
							class="p-1.5 rounded-full hover:bg-error-bg transition-colors text-muted hover:text-red-600 cursor-pointer"
							title="Delete"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								class="w-4 h-4"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<polyline points="3 6 5 6 21 6" />
								<path d="M19 6l-1 14H6L5 6" />
								<path d="M10 11v6" />
								<path d="M14 11v6" />
								<path d="M9 6V4h6v2" />
							</svg>
						</button>
					</div>
				</td>
			</tr>
		</template>

		<template #modals>
			<Teleport to="body">
				<UserFormModal
					v-if="showModal"
					:editing-user="editingUser"
					@close="closeModal"
					@saved="onSaved"
				/>
			</Teleport>
		</template>
	</DataTable>
</template>
