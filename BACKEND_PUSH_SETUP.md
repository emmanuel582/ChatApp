
# Guide: Setting up Full Background Push Notifications

Currently, the frontend is configured to:
1. Register a Service Worker (`sw.js`).
2. Request Permission from the user.
3. Subscribe to the Push Service (FCM/Mozilla).
4. Store the `subscription` object in your Supabase `push_subscriptions` table.

## The Missing Link: The Backend Trigger
For a user to receive a notification *when the app is closed*, a **server** must trigger the push. The frontend (React) cannot do this because it is closed.

You need to deploy a **Supabase Edge Function** that listens to database changes (Database Webhook) or is called via a Trigger.

### 1. Create Supabase Edge Function `send-push`

Use the Supabase CLI to create a function `supabase functions new send-push`.
Paste the following code into the `index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import webpush from "npm:web-push"

// VAPID Keys (Generated previously)
// Store these in your Supabase Secrets: supabase secrets set PUBLIC_VAPID_KEY=... PRIVATE_VAPID_KEY=...
const publicVapidKey = "BBZYM5uX9RvLdWH0ATTNjLVlV2Rs7tEuYWpCp-wcbyVFFDqz26hhfGytGaxH5ZqA48eIYOLWvoEaEhyFkEIkHH0";
const privateVapidKey = "4nYlt-BhQ6FSgLimC1jihuGoOv1DAeaR0z4XUtnNRJU"; // KEEP PRIVATE!

webpush.setVapidDetails(
  'mailto:admin@chatapp.com',
  publicVapidKey,
  privateVapidKey
);

serve(async (req) => {
  const { record } = await req.json(); // Payload from Database Webhook
  
  // Record is the new message row
  const recipientId = record.recipient_id;
  const content = record.content;

  // Initialize Supabase Client to fetch subscription
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get recipient's subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', recipientId);

  if (!subs || subs.length === 0) {
    return new Response("No subscriptions user", { status: 200 });
  }

  // Send Push to all devices
  const payload = JSON.stringify({ title: 'New Message', body: content });
  
  const promises = subs.map(s => 
    webpush.sendNotification(s.subscription, payload).catch(err => {
        if (err.statusCode === 410) {
             // Expired subscription, delete from DB (optional)
        }
        console.error("Error sending push", err);
    })
  );

  await Promise.all(promises);

  return new Response("Push sent", { status: 200 });
})
```

### 2. Set Up Database Webhook

In your Supabase Dashboard:
1. Go to **Database** -> **Webhooks**.
2. Create a new Webhook.
3. Event: `INSERT` on table `messages`.
4. URL: Use the URL of your deployed Edge Function (e.g., `https://[project-ref].supabase.co/functions/v1/send-push`).
5. HTTP Method: `POST`.
6. Add Header: `Authorization: Bearer [your-service-key-or-anon-key]`.

Once this is done, every time a message is sent, Supabase will wake up your function, which will wake up the User's device via the Web Push Protocol!
