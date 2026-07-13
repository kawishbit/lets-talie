<script setup lang="ts">
	import { formatDate } from "@utils/date.ts";
	import { ref } from "vue";
	import IconPencil from "~icons/lucide/pencil";
	import IconPlus from "~icons/lucide/plus";
	import IconTrash2 from "~icons/lucide/trash-2";
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
					<IconPlus class="w-4 h-4" aria-hidden="true" />
					Add user
				</button>
			</div>
		</template>

		<template #head>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Name
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Email
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Role
			</th>
			<th
				class="text-right px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
			>
				Balance
			</th>
			<th
				class="text-left px-4 py-3 font-medium text-label text-xs uppercase tracking-wider whitespace-nowrap"
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
				<td class="px-4 py-3 font-[450] whitespace-nowrap">{{ u.name }}</td>
				<td class="px-4 py-3 text-label whitespace-nowrap">
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
				<td class="px-4 py-3 text-right whitespace-nowrap">
					<span
						:class="parseFloat(u.accountBalance ?? '0') >= 0 ? 'text-green-700' : 'text-red-600'"
					>
						{{ formatBalance(u.accountBalance) }}
					</span>
				</td>
				<td class="px-4 py-3 text-muted whitespace-nowrap">
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
							<IconPencil class="w-4 h-4" aria-hidden="true" />
						</button>
						<button
							v-if="u.id !== currentUserId"
							type="button"
							@click="deleteUser(u)"
							class="p-1.5 rounded-full hover:bg-error-bg transition-colors text-muted hover:text-red-600 cursor-pointer"
							title="Delete"
						>
							<IconTrash2 class="w-4 h-4" aria-hidden="true" />
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
