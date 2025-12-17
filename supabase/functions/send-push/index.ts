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
  console.log("Received Push Webhook for record:", record.id);
  
  // Record is the new message row
  const recipientId = record.recipient_id;
  const content = record.content;

  // Initialize Supabase Client to fetch subscription
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log("Fetching subscriptions for user:", recipientId);

  // Get recipient's subscriptions
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', recipientId);

  if (!subs || subs.length === 0) {
    console.log("No subscriptions found for this user.");
    return new Response("No subscriptions user", { status: 200 });
  }

  console.log(`Found ${subs.length} subscriptions. Preparing to send...`);

  const type = record.type;
  
  let bodyText = content;
  if (type === 'image') bodyText = 'Sent a photo 📷';
  if (type === 'audio') bodyText = 'Sent a voice note 🎤';

  // Send Push to all devices
  const payload = JSON.stringify({ title: 'New Message', body: bodyText });
  
  const promises = subs.map((s, index) => {
    console.log(`Sending to device ${index + 1}...`);
    return webpush.sendNotification(s.subscription, payload)
        .then(() => console.log(`Device ${index + 1} Success`))
        .catch(err => {
            if (err.statusCode === 410) {
                console.log(`Device ${index + 1} expired (410).`);
                 // Expired subscription, delete from DB (optional)
            }
            console.error(`Device ${index + 1} Failed`, err);
        });
  });

  await Promise.all(promises);

  console.log("All push attempts finished.");
  return new Response("Push sent", { status: 200 });
})