import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { JWT } from "npm:google-auth-library"

serve(async (req) => {
  const { record } = await req.json(); 
  console.log("Received Push Webhook for record:", record.id);
  
  const recipientId = record.recipient_id;
  const content = record.content;
  const type = record.type;
  
  let bodyText = content;
  if (type === 'image') bodyText = 'Sent a photo 📷';
  if (type === 'audio') bodyText = 'Sent a voice note 🎤';

  // 1. Initialize Supabase Client
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 2. Get recipient's FCM tokens
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', recipientId);

  if (!subs || subs.length === 0) {
    console.log("No subscriptions found for this user.");
    return new Response("No subscriptions", { status: 200 });
  }

  // 3. Authenticate with Google for FCM v1
  // Expecting FIREBASE_SERVICE_ACCOUNT as a JSON string secret
  const serviceAccountStr = Deno.env.get('FIREBASE_SERVICE_ACCOUNT');
  if (!serviceAccountStr) {
      console.error("FIREBASE_SERVICE_ACCOUNT secret not set!");
      return new Response("Server Config Error", { status: 500 });
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountStr);
  } catch (e) {
    console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON", e);
    return new Response("Server Config Error", { status: 500 });
  }

  const client = new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
  });

  const credentials = await client.getAccessToken();
  const accessToken = credentials.token;
  const projectId = serviceAccount.project_id;

  // 4. Send notifications
  const promises = subs.map(async (s) => {
    const fcmToken = s.subscription.endpoint || s.subscription.token; 
    
    if (!fcmToken) return;

    try {
        const chatUrl = `/dashboard?chat=${record.sender_id}`;
        const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                message: {
                    token: fcmToken,
                    notification: {
                        title: 'New Message',
                        body: bodyText,
                    },
                    webpush: {
                        fcm_options: {
                            link: chatUrl
                        }
                    },
                    data: {
                        url: chatUrl,
                        sender_id: record.sender_id
                    }
                }
            })
        });
        const result = await res.json();
        console.log("FCM v1 Send Result:", result);
    } catch (err) {
        console.error("FCM v1 Send Error:", err);
    }
  });

  await Promise.all(promises);

  return new Response("Push sent", { status: 200 });
})