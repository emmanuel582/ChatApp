# Admin Ghost Mode Guide

Follow these steps to enable and use the Admin Ghost Mode features.

## Step 1: Initialize Database
You must add the necessary columns to your database.

1. Go to your **Supabase Dashboard** -> **SQL Editor**.
2. Create a new query.
3. Copy and paste the entire content of the file `admin_schema.sql` (found in your project folder).
4. Run the query.

## Step 2: Make Yourself an Admin
By default, no one is an admin. You must manually promote your account.

1. In the Supabase SQL Editor, run the following command (Replace `your_email@example.com` with your actual login email):

```sql
UPDATE profiles
SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE email = 'your_email@example.com');
```

*Verification*: You can go to the **Table Editor** -> **profiles** table and ensure the `is_admin` checkbox is checked for your user.

## Step 3: Accessing the Admin Dashboard
1. Start your app (`npm run dev`).
2. In your browser, change the URL to:
   `http://localhost:5173/admin`
3. If you are logged in as the admin user, you will see the **Ghost Admin Panel**.

## Step 4: Using Ghost Mode
1. In the Admin Panel, search for a user's username (e.g., "john").
2. Click the arrow button next to the user.
3. You will enter their **Inbox** as if you were them.
4. Open a chat. You can see their messages.
5. **Sending Messages**:
   - Any message you send here will appear in the chat for **YOU** (the Admin).
   - The **Recipient** will see it (ghost message).
   - The **Real Account Owner** (impersonated victim) will **NOT** see this message.
   - Ghost messages appear with a **Dark Red** background to indicate they are hidden.

---
**Note**: If you get a "400 Error" when sending a message, it means you skipped Step 1. Run the `admin_schema.sql` script!
