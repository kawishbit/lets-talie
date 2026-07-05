Project Name: lets-talie

Short Description: lets-talie is a PWA (Progressive Web Application) to help friends and family members track their splitting of bills. It allows users to create groups and have balances calculated automatically. If your balance is negative, it means you owe money to the group. If your balance is positive, it means the group owes you money. 


## Tech stack
- Astro JS 
- Vue integration
- Supabase / Postgres 
- Tailwind CSS 
- Vercel
- Better Auth 
- Drizzle ORM 
- Bun JS 
- Typescript 
- PWA implementation with service workers and offline support

## Database Tables

### Better Auth Core Schema
The following tables are part of the Better Auth core schema. Additional fields have been added to the `user` table: role and account_balance.

#### `user` Table

Stores the core user profile information.

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `VARCHAR/TEXT` | Primary Key |
| `name` | `VARCHAR/TEXT` | Not Null |
| `email` | `VARCHAR/TEXT` | Unique, Not Null |
| `emailVerified` | `BOOLEAN` | Not Null, Default: `false` |
| `image` | `VARCHAR/TEXT` | Nullable |
| `createdAt` | `TIMESTAMP` | Not Null |
| `updatedAt` | `TIMESTAMP` | Not Null |
| **`role`** | `VARCHAR/TEXT` | Not Null, Default: `'user'` (Allowed: `'admin'`, `'user'`) |
| **`account_balance`** | `DECIMAL(10,2)` | Not Null, Default: `0.00` |

---

#### `session` Table

Tracks active user sessions.

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `VARCHAR/TEXT` | Primary Key |
| `expiresAt` | `TIMESTAMP` | Not Null |
| `token` | `VARCHAR/TEXT` | Unique, Not Null |
| `createdAt` | `TIMESTAMP` | Not Null |
| `updatedAt` | `TIMESTAMP` | Not Null |
| `ipAddress` | `VARCHAR/TEXT` | Nullable |
| `userAgent` | `VARCHAR/TEXT` | Nullable |
| `userId` | `VARCHAR/TEXT` | Foreign Key → `user.id`, On Delete: Cascade |

---

#### `account` Table

Handles OAuth providers and credentials (e.g., Google, GitHub, or email/password links).

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `VARCHAR/TEXT` | Primary Key |
| `accountId` | `VARCHAR/TEXT` | Not Null (Provider's user ID) |
| `providerId` | `VARCHAR/TEXT` | Not Null (e.g., `'google'`, `'credential'`) |
| `userId` | `VARCHAR/TEXT` | Foreign Key → `user.id`, On Delete: Cascade |
| `accessToken` | `VARCHAR/TEXT` | Nullable |
| `refreshToken` | `VARCHAR/TEXT` | Nullable |
| `idToken` | `VARCHAR/TEXT` | Nullable |
| `accessTokenExpiresAt` | `TIMESTAMP` | Nullable |
| `refreshTokenExpiresAt` | `TIMESTAMP` | Nullable |
| `scope` | `VARCHAR/TEXT` | Nullable |
| `password` | `VARCHAR/TEXT` | Nullable (Hashed password for email/password auth) |
| `createdAt` | `TIMESTAMP` | Not Null |
| `updatedAt` | `TIMESTAMP` | Not Null |

---

#### `verification` Table

Used for password resets, email verification links, and OTPs.

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `VARCHAR/TEXT` | Primary Key |
| `identifier` | `VARCHAR/TEXT` | Not Null (e.g., email address) |
| `value` | `VARCHAR/TEXT` | Not Null (Token or OTP hash) |
| `expiresAt` | `TIMESTAMP` | Not Null |
| `createdAt` | `TIMESTAMP` | Nullable |
| `updatedAt` | `TIMESTAMP` | Nullable |


### Transaction schema 
The following tables are part of the transaction schema for lets-talie. 

#### `transaction_categories` Table

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `uuid` | Primary Key (implicit), Default: `gen_random_uuid()`, Not Null |
| `label` | `text` | Not Null |
| `createdAt` | `timestamp with time zone` | Default: `now()`, Not Null |
| `updatedAt` | `timestamp with time zone` | Default: `now()`, Not Null |
| `createdBy` | `uuid` | Default: `public.request_user_id()` |
| `updatedBy` | `uuid` | Default: `public.request_user_id()` |
| `isDeleted` | `boolean` | Default: `false`, Not Null |
| `remarks` | `text` | Nullable |

---

#### `transactions` Table

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `uuid` | Primary Key (implicit), Default: `gen_random_uuid()`, Not Null |
| `name` | `text` | Not Null |
| `transactionRemarks` | `text` | Nullable |
| `transactionDate` | `date` | Default: `CURRENT_DATE`, Not Null |
| `paidBy` | `uuid` | Not Null |
| `amount` | `numeric(12,2)` | Not Null, Check: `amount > 0` |
| `type` | `text` | Not Null, Check: Must be `'deposit'` or `'withdraw'` |
| `status` | `text` | Default: `'pending'`, Not Null, Check: Must be `'pending'`, `'completed'`, or `'cancelled'` |
| `transactionGroupId` | `uuid` | Not Null |
| `transactionCategoryId` | `uuid` | Nullable |
| `createdAt` | `timestamp with time zone` | Default: `now()`, Not Null |
| `updatedAt` | `timestamp with time zone` | Default: `now()`, Not Null |
| `createdBy` | `uuid` | Default: `public.request_user_id()` |
| `updatedBy` | `uuid` | Default: `public.request_user_id()` |
| `isDeleted` | `boolean` | Default: `false`, Not Null |
| `remarks` | `text` | Nullable |

## Features

### Admin
- View all transactions (with filters and sorting)
- View all users
- View all transaction categories
- Approve transactions / reject transactions (approve/reject grouped transactions at once)
- Add transaction categories
- Edit transaction categories
- Delete transaction categories
- Add users 
- Edit users
- Delete users
- Import transactions from CSV or JSON (with validation and error handling)

### Shared between Admin and User
- View current balance 
- Add group transactions (User: pending approval by admin. Admin: approved automatically)
- View your transactions history (User: only your transactions. Admin: all transactions)

### Transaction Group calculation and description 

You can understand the transaction group calculation by reading the following example:
- There are User A, B and C.
- Assume that each one has 0 balance.
- A, B and C ride an uber from home to work.
- User-A pays the bill that costs $30.
- User-A adds a new transaction to the system.
- The form will ask for a transaction name, remarks, amount, paid by and parties involved (an array of other users).
- User-A fills in the form, sets in User-A as Paid By, adds User-B and User-C as parties.
- UI will send this data to the backend.
- Create transaction logic will process the data.
- It will be separated into 4 transaction records with the same group key:
  - Transaction 1 = User-A tops up $30 into the system (amount=30,type=deposit,status=completed,category=transport,group-key=sample-random-group-key)
  - Transaction 2 = User-A pays $10 (amount=10,type=withdraw,status=completed,category=transport,group-key=sample-random-group-key)
  - Transaction 3 = User-B pays $10 (amount=10,type=withdraw,status=completed,category=transport,group-key=sample-random-group-key)
  - Transaction 4 = User-C pays $10 (amount=10,type=withdraw,status=completed,category=transport,group-key=sample-random-group-key)
- After this transaction, User-A's balance is 20, User-B's balance is -10, User-C's balance is -10

We do the calculation in code. 
From the UI perspective, the group transaction form should be different from the single transaction form. Group transaction form should have: transaction name, date, remarks, amount, paid by (dropdown), parties involved (multi-select dropdown), category (dropdown). It should have the ability to use custom amount for each party involved. If custom amount is not set, the system will divide the amount equally among all parties involved.
The single transaction form should follow the transaction table schema. It should have: transaction name, date, remarks, amount, paid by (dropdown), type (deposit/withdraw), status (pending/completed/cancelled), category (dropdown).


### Transaction Facts 

- For every transaction added, we need to recalculate the balances of all users involved in that transaction group.
- The balance of a user is the sum of all deposits minus the sum of all withdrawals for that user.
- To delete a transaction that is in a group, we need to delete all transactions in that group and recalculate the balances of all users involved in that transaction group.
- Instead of getting all transactions for a user and calculating the balance, we store the balance in the user table and update it whenever a transaction is added or deleted. This is to avoid performance issues when there are many transactions.


## Pages

### Main 
Path: `/`
- Displays the current balance of the logged-in user.
- Displays the form to add a new group transaction and the form to add a new single transaction.

### Transactions
Path: `/transactions`
- Displays the list of transactions for the logged-in user.
- Displays filters and sorting options for the transactions list.

### Users (admin only)
Path: `/users`
- Displays the list of users.
- Displays buttons for CRUD operations.
- Displays filters and sorting options for the users list.

### Transaction Categories (admin only)
Path: `/transaction-categories`
- Displays the list of transaction categories.
- Displays buttons for CRUD operations.
- Displays filters and sorting options for the transaction categories list.


### Import Transactions (admin only)
Path: `/import-transactions`
- Displays the form to import transactions from CSV or JSON.
- Displays validation errors if any.
- For this function, recalculate the balances of all users involved in the imported transactions after the import is complete.

### Approval of Transactions (admin only)
Path: `/approve-transactions`
- Displays the list of pending transactions for approval.
- Displays buttons to approve or reject transactions (approve/reject grouped transactions at once).