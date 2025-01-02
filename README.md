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

## Setup
1. Clone this repository
2. Install dependencies: `npm install`
3. Copy config.example.json to config.json
4. Edit config.json with your X API credentials
5. Run the script: `node unblock.js`

This code (written with the help of Claude) automates the unblock process for you with some significant caveats.

The current X rate limits for this endpoint are fairly extreme and apply to both getting the blocked user *and* doing the unblock:

- Pro: 15 requests per 15 minutes per user
- Basic: 5 requests per 15 minutes per user
- Free: 1 request per 15 minutes per user

For each user you first need to fetch that user and the unblock them (2 requests).

This means if you have 50k users blocked you're looking at the following timelines to fetch *and* to then unblock at each tier:

Free Tier (1 request/15 mins):
- 50,000 users ÷ (1 request / 15 mins) = 750,000 minutes = ~521 days 😱 * 2 = ~1,042 days (2.85 years)

Basic Tier ($200/month, 5 requests/15 mins):
- 50,000 users ÷ (5 requests / 15 mins) = 150,000 minutes = ~104 days * 2 = ~208 days (6.9 months)

Pro Tier ($5000/month, 15 requests/15 mins):
- 50,000 users ÷ (15 requests / 15 mins) = 50,000 minutes = ~35 days * 2 = ~70 days (2.3 months)

The script will show progress in the console as it runs.

You can stop the script at any time with Ctrl+C.

If your computer restarts or the script stops, just run it again and it will continue where it left off.