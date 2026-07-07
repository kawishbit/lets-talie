<script setup lang="ts">
	import { formatDate } from "@utils/date.ts";
	import { ref } from "vue";
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

	const users = ref<User[]>(props.initialUsers);
	const total = ref(props.initialTotal);
	const page = ref(props.initialPage);
	const roleFilter = ref<"" | "user" | "admin">("");
	const loading = ref(false);
	const error = ref("");

	const showModal = ref(false);
	const editingUser = ref<User | null>(null);

	const totalPages = ref(Math.ceil(props.initialTotal / props.pageSize));

	async function fetchUsers(p = page.value) {
		loading.value = true;
		error.value = "";
		try {
			const params = new URLSearchParams({
				page: String(p),
				pageSize: String(props.pageSize),
			});
			if (roleFilter.value) params.set("role", roleFilter.value);
			const res = await fetch(`/api/users?${params}`);
			if (!res.ok) throw new Error("Failed to fetch users");
			const data = await res.json();
			users.value = data.items;
			total.value = data.total;
			page.value = data.page;
			totalPages.value = Math.ceil(data.total / props.pageSize);
		} catch {
			error.value = "Failed to load users.";
		} finally {
			loading.value = false;
		}
	}

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
		await fetchUsers(page.value);
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
			await fetchUsers(page.value);
		} catch {
			alert("Network error. Please try again.");
		}
	}

	function formatBalance(raw: string) {
		const n = parseFloat(raw ?? "0");
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
			signDisplay: "always",
		}).format(n);
	}
</script>

<template>
	<!-- Toolbar -->
	<div
		class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"
	>
		<div class="flex items-center gap-2">
			<!-- Role filter -->
			<select
				v-model="roleFilter"
				@change="fetchUsers(1)"
				class="px-3 py-2 rounded-xl border border-(--color-hairline) text-sm outline-none focus:border-(--color-ink) transition-colors bg-(--color-input-bg)"
			>
				<option value="">All roles</option>
				<option value="user">User</option>
				<option value="admin">Admin</option>
			</select>
		</div>
		<button
			type="button"
			@click="openCreate"
			class="inline-flex items-center gap-1.5 bg-(--color-ink) text-(--color-canvas) px-4 py-2 rounded-full text-sm font-[480] tracking-[-0.01em] hover:opacity-80 transition-opacity cursor-pointer"
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

	<p v-if="error" class="text-sm text-red-600 mb-4">{{ error }}</p>

	<!-- Table -->
	<div class="border border-(--color-hairline) rounded-2xl overflow-hidden">
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-(--color-hairline) bg-(--color-surface)">
						<th
							class="text-left px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider"
						>
							Name
						</th>
						<th
							class="text-left px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider hidden sm:table-cell"
						>
							Email
						</th>
						<th
							class="text-left px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider"
						>
							Role
						</th>
						<th
							class="text-right px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider hidden md:table-cell"
						>
							Balance
						</th>
						<th
							class="text-left px-4 py-3 font-[500] text-(--color-label) text-xs uppercase tracking-wider hidden lg:table-cell"
						>
							Joined
						</th>
						<th class="px-4 py-3" />
					</tr>
				</thead>
				<tbody :class="{ 'opacity-50 pointer-events-none': loading }">
					<tr
						v-for="u in users"
						:key="u.id"
						class="border-b border-(--color-hairline) last:border-0 hover:bg-(--color-faint) transition-colors"
					>
						<td class="px-4 py-3 font-[450]">{{ u.name }}</td>
						<td class="px-4 py-3 text-(--color-label) hidden sm:table-cell">
							{{ u.email }}
						</td>
						<td class="px-4 py-3">
							<span
								:class="[
                  'inline-block px-2 py-0.5 rounded-full text-xs font-[500]',
                  u.role === 'admin'
                    ? 'bg-(--color-ink) text-(--color-canvas)'
                    : 'bg-(--color-surface) text-(--color-label)',
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
						<td class="px-4 py-3 text-(--color-muted) hidden lg:table-cell">
							{{ formatDate(u.createdAt) }}
						</td>
						<td class="px-4 py-3">
							<div class="flex items-center justify-end gap-1">
								<button
									type="button"
									@click="openEdit(u)"
									class="p-1.5 rounded-full hover:bg-(--color-surface) transition-colors text-(--color-label) hover:text-(--color-ink) cursor-pointer"
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
									type="button"
									v-if="u.id !== currentUserId"
									@click="deleteUser(u)"
									class="p-1.5 rounded-full hover:bg-(--color-error-bg) transition-colors text-(--color-muted) hover:text-red-600 cursor-pointer"
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
					<tr v-if="!loading && users.length === 0">
						<td
							colspan="6"
							class="px-4 py-10 text-center text-(--color-muted) text-sm"
						>
							No users found.
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>

	<!-- Pagination -->
	<div v-if="totalPages > 1" class="flex items-center justify-between mt-4">
		<p class="text-sm text-(--color-muted)">
			Page {{ page }} of {{ totalPages }} &middot; {{ total }} users
		</p>
		<div class="flex gap-2">
			<button
				type="button"
				@click="fetchUsers(page - 1)"
				:disabled="page <= 1 || loading"
				class="px-3 py-1.5 rounded-full border border-(--color-hairline) text-sm font-[480] hover:bg-(--color-surface) transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
			>
				Previous
			</button>
			<button
				type="button"
				@click="fetchUsers(page + 1)"
				:disabled="page >= totalPages || loading"
				class="px-3 py-1.5 rounded-full border border-(--color-hairline) text-sm font-[480] hover:bg-(--color-surface) transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
			>
				Next
			</button>
		</div>
	</div>

	<!-- Modal -->
	<Teleport to="body">
		<UserFormModal
			v-if="showModal"
			:editing-user="editingUser"
			@close="closeModal"
			@saved="onSaved"
		/>
	</Teleport>
</template>
