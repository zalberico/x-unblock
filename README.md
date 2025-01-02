# x-unblock
Unblock All Blocked Users on X

There's a bug on X where if you have a lot of historically blocked users, none of them will load in the UI of your profile settings. This makes them impossible to unblock.

For example - if you have 50k blocked user and none of them show up in the blocked users section of your profile settings, then the only way you can unblock them in the UI is by stumbling on users you've blocked in the replies or links of others.

Download and install Node from: https://nodejs.org/

You'll need an X developer account as a prerequisite:
   - Sign up at: https://developer.x.com/en/portal/products
   - Create a new project/app in the developer portal
   - Get your API credentials:
     - API Key
     - API Key Secret
     - Access Token
     - Access Token Secret

Clone this repo and install the required packages:
- npm install

Add your credentials to the script:
```
const API_KEY = 'your_api_key';
const API_KEY_SECRET = 'your_api_key_secret';
const ACCESS_TOKEN = 'your_access_token';
const ACCESS_TOKEN_SECRET = 'your_access_token_secret';
```

This code (written with the help of Claude) automates the unblock process for you with some significant caveats.

The current X rate limits for this endpoint are fairly extreme:

- Pro: 15 requests per 15 minutes per user
- Basic: 5 requests per 15 minutes per user
- Free: 1 request per 15 minutes per user

This means if you have 50k users blocked you're looking at the following timelines:

Free Tier (1 request/15 mins):
- 50,000 users ÷ (1 request / 15 mins) = 750,000 minutes = ~521 days 😱

Basic Tier ($200/month, 5 requests/15 mins):
- 50,000 users ÷ (5 requests / 15 mins) = 150,000 minutes = ~104 days

Pro Tier ($5000/month, 15 requests/15 mins):
- 50,000 users ÷ (15 requests / 15 mins) = 50,000 minutes = ~35 days

The script will run for a very long time depending on your tier.

The script will show progress in the console as it runs.

You can stop the script at any time with Ctrl+C.

If your computer restarts or the script stops, just run it again and it will continue where it left off.

If you see rate limit errors:
This is expected - the script will wait the required time and continue

Run the script with:
```
node unblock.js
```