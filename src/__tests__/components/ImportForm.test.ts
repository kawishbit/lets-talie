import ImportForm from "@components/ImportForm.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ imported: 1 }),
		}),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

async function uploadFile(wrapper: ReturnType<typeof mount>, file: File) {
	const input = wrapper.find('input[type="file"]').element as HTMLInputElement;
	Object.defineProperty(input, "files", { value: [file], writable: false });
	await wrapper.find('input[type="file"]').trigger("change");
	await flushPromises();
}

describe("ImportForm", () => {
	it("parses and previews valid CSV rows", async () => {
		const csv =
			"name,date,amount,paidByUserId,type,status\nGroceries,2026-01-10,42.50,user-a,withdrawal,completed";
		const file = new File([csv], "rows.csv", { type: "text/csv" });

		const wrapper = mount(ImportForm);
		await uploadFile(wrapper, file);

		expect(wrapper.text()).toContain("Preview");
		expect(wrapper.text()).toContain("Groceries");
		expect(
			wrapper.find('button[type="button"]').attributes("disabled"),
		).toBeUndefined();
	});

	it("parses and previews valid JSON rows", async () => {
		const json = JSON.stringify([
			{
				name: "Rent",
				date: "2026-01-01",
				amount: 1200,
				paidByUserId: "user-a",
				type: "withdrawal",
				status: "completed",
			},
		]);
		const file = new File([json], "rows.json", { type: "application/json" });

		const wrapper = mount(ImportForm);
		await uploadFile(wrapper, file);

		expect(wrapper.text()).toContain("Rent");
	});

	it("shows per-row validation errors for invalid CSV rows", async () => {
		const csv =
			"name,date,amount,paidByUserId,type,status\nGroceries,2026-01-10,-5,user-a,withdrawal,completed";
		const file = new File([csv], "rows.csv", { type: "text/csv" });

		const wrapper = mount(ImportForm);
		await uploadFile(wrapper, file);

		expect(wrapper.text()).toContain("amount must be a positive number");
	});

	it("shows per-row validation errors for invalid JSON rows", async () => {
		const json = JSON.stringify([
			{
				name: "Bad row",
				date: "2026-01-01",
				amount: -5,
				paidByUserId: "user-a",
				type: "withdrawal",
				status: "completed",
			},
		]);
		const file = new File([json], "rows.json", { type: "application/json" });

		const wrapper = mount(ImportForm);
		await uploadFile(wrapper, file);

		expect(wrapper.text()).toContain("amount must be a positive number");
	});

	it("disables submit while validation errors exist", async () => {
		const csv =
			"name,date,amount,paidByUserId,type,status\nGroceries,2026-01-10,-5,user-a,withdrawal,completed";
		const file = new File([csv], "rows.csv", { type: "text/csv" });

		const wrapper = mount(ImportForm);
		await uploadFile(wrapper, file);

		const submitBtn = wrapper
			.findAll("button")
			.find((b) => b.text().includes("Import"));
		expect(submitBtn?.attributes("disabled")).toBeDefined();
	});

	it("submits a valid file to the API and shows a success message", async () => {
		const csv =
			"name,date,amount,paidByUserId,type,status\nGroceries,2026-01-10,42.50,user-a,withdrawal,completed";
		const file = new File([csv], "rows.csv", { type: "text/csv" });

		const wrapper = mount(ImportForm);
		await uploadFile(wrapper, file);

		const submitBtn = wrapper
			.findAll("button")
			.find((b) => b.text().includes("Import"));
		await submitBtn?.trigger("click");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/transactions/import",
			expect.objectContaining({ method: "POST" }),
		);
		expect(wrapper.text()).toContain("Import successful!");
	});

	it("submits a JSON file as an application/json body (not multipart)", async () => {
		const json = JSON.stringify([
			{
				name: "Rent",
				date: "2026-01-01",
				amount: 1200,
				paidByUserId: "John",
				type: "withdrawal",
				status: "completed",
			},
		]);
		const file = new File([json], "rows.json", { type: "application/json" });

		const wrapper = mount(ImportForm);
		await uploadFile(wrapper, file);

		const submitBtn = wrapper
			.findAll("button")
			.find((b) => b.text().includes("Import"));
		await submitBtn?.trigger("click");
		await flushPromises();

		expect(fetch).toHaveBeenCalledWith(
			"/api/transactions/import",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: json,
			}),
		);
		expect(wrapper.text()).toContain("Import successful!");
	});

	it("flags an unresolvable categoryId as a row error and disables submit", async () => {
		const csv =
			"name,date,amount,paidByUserId,type,status,categoryId\nDinner,2026-01-10,10,John,deposit,pending,doesnotexist";
		const file = new File([csv], "rows.csv", { type: "text/csv" });

		const wrapper = mount(ImportForm, {
			props: {
				users: [{ id: "u1", name: "John Doe", email: "john@x.test" }],
				categories: [{ id: "c1", label: "Food" }],
			},
		});
		await uploadFile(wrapper, file);

		expect(wrapper.text()).toContain("did not match any category");
		const submitBtn = wrapper
			.findAll("button")
			.find((b) => b.text().includes("Import"));
		expect(submitBtn?.attributes("disabled")).toBeDefined();
	});

	it("accepts id-or-name references that resolve against the provided lookups", async () => {
		const csv =
			"name,date,amount,paidByUserId,type,status,categoryId\nDinner,2026-01-10,10,John,deposit,pending,foo";
		const file = new File([csv], "rows.csv", { type: "text/csv" });

		const wrapper = mount(ImportForm, {
			props: {
				users: [{ id: "u1", name: "John Doe", email: "john@x.test" }],
				categories: [{ id: "c1", label: "Food" }],
			},
		});
		await uploadFile(wrapper, file);

		expect(wrapper.text()).not.toContain("did not match");
		const submitBtn = wrapper
			.findAll("button")
			.find((b) => b.text().includes("Import"));
		expect(submitBtn?.attributes("disabled")).toBeUndefined();
	});

	it("shows a parse error for a non-csv/json file", async () => {
		const file = new File(["hello"], "notes.txt", { type: "text/plain" });

		const wrapper = mount(ImportForm);
		await uploadFile(wrapper, file);

		expect(wrapper.text()).toContain("Please upload a .csv or .json file.");
	});
});
