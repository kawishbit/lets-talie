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
The following tables are part of the Better Auth core schema used by the app. The `user` table also exposes additional fields through Better Auth: `role`, `accountBalance`, `banned`, `banReason`, `banExpires`, and `deletedAt`.

#### `user` Table

Stores the core user profile information.

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `text` | Primary Key |
| `name` | `text` | Not Null |
| `email` | `text` | Unique, Not Null |
| `emailVerified` | `boolean` | Not Null, Default: `false` |
| `image` | `text` | Nullable |
| `createdAt` | `timestamp` | Not Null |
| `updatedAt` | `timestamp` | Not Null |
| `role` | `text` | Default: `'user'` |
| `accountBalance` | `text` | Default: `'0.00'` |
| `banned` | `boolean` | Default: `false` |
| `banReason` | `text` | Nullable |
| `banExpires` | `timestamp` | Nullable |
| `deletedAt` | `timestamp` | Nullable |

---

#### `session` Table

Tracks active user sessions.

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `text` | Primary Key |
| `expiresAt` | `timestamp` | Not Null |
| `token` | `text` | Unique, Not Null |
| `createdAt` | `timestamp` | Not Null |
| `updatedAt` | `timestamp` | Not Null |
| `ipAddress` | `text` | Nullable |
| `userAgent` | `text` | Nullable |
| `impersonatedBy` | `text` | Nullable |
| `userId` | `text` | Foreign Key → `user.id`, On Delete: Cascade |

---

#### `account` Table

Handles OAuth providers and credentials (for example Google, GitHub, or email/password links).

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `text` | Primary Key |
| `accountId` | `text` | Not Null |
| `providerId` | `text` | Not Null |
| `userId` | `text` | Foreign Key → `user.id`, On Delete: Cascade |
| `accessToken` | `text` | Nullable |
| `refreshToken` | `text` | Nullable |
| `idToken` | `text` | Nullable |
| `accessTokenExpiresAt` | `timestamp` | Nullable |
| `refreshTokenExpiresAt` | `timestamp` | Nullable |
| `scope` | `text` | Nullable |
| `password` | `text` | Nullable |
| `createdAt` | `timestamp` | Not Null |
| `updatedAt` | `timestamp` | Not Null |

---

#### `verification` Table

Used for password resets, email verification links, and OTPs.

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `text` | Primary Key |
| `identifier` | `text` | Not Null |
| `value` | `text` | Not Null |
| `expiresAt` | `timestamp` | Not Null |
| `createdAt` | `timestamp` | Not Null |
| `updatedAt` | `timestamp` | Not Null |

### Transaction schema
The following tables are part of the app transaction schema for lets-talie.

#### `transaction_categories` Table

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `text` | Primary Key |
| `label` | `text` | Not Null |
| `remarks` | `text` | Nullable |
| `createdAt` | `timestamp` | Not Null |
| `updatedAt` | `timestamp` | Not Null |
| `deletedAt` | `timestamp` | Nullable |

---

#### `transactions` Table

| Field Name | Data Type | Constraints / Description |
| --- | --- | --- |
| `id` | `text` | Primary Key |
| `transactionGroupId` | `text` | Nullable |
| `name` | `text` | Not Null |
| `date` | `timestamp` | Not Null |
| `remarks` | `text` | Nullable |
| `amount` | `numeric(10,2)` | Not Null |
| `type` | `text` | Not Null (for example `'deposit'` or `'withdrawal'`) |
| `status` | `text` | Not Null, Default: `'pending'` |
| `createdByUserId` | `text` | Not Null, Foreign Key → `user.id` |
| `lastUpdatedByUserId` | `text` | Nullable, Foreign Key → `user.id` |
| `paidByUserId` | `text` | Not Null, Foreign Key → `user.id` |
| `categoryId` | `text` | Nullable, Foreign Key → `transaction_categories.id` |
| `createdAt` | `timestamp` | Not Null |
| `updatedAt` | `timestamp` | Not Null |
| `deletedAt` | `timestamp` | Nullable |

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
- Add single transactions (User: pending approval by admin. Admin: approved automatically)
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