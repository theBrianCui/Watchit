# Watchit
A self-hosted, desktop Node.js app that observes any number of subreddits and delivers email notifications for new, filtered Reddit posts. It's totally free and is available for Windows, Mac, and Linux. Features support for...

- **Unlimited subreddits**. Want to get notifications for new posts on both [/r/buildapcsales](https://www.reddit.com/r/buildapcsales/new/) and [/r/gamedeals](https://www.reddit.com/r/gamedeals/new/)? Watchit can check as many subreddits as you want on a single instance, with a unique configuration for each, and will even queue its requests appropriately so it doesn't hog bandwidth.
- **Unlimited filters**. Get notified only for the posts you deem worthy. Configure notifications for posts based on age, votes, title, self-post text, and more.
- **Email notifications** for posts using MailGun (free), SendGrid (free), or Mandrill (paid).
- **Custom HTML email templates** for every subreddit. Be brief and include just post titles and URLs, or include post scores, comment counts, age, and more in your emails.

Watchit will regularly poll the *new posts* of subreddits on a configurable interval and send you notification emails for posts meeting certain criteria, as defined by filters on a per-subreddit basis.  

Quick Setup Guide
-----------
The fastest way to get up and running is to use the precompiled executables, compiled with [JXCore](jxcore.com). To run Watchit from source, check out the [For Developers](#for-developers) section below.

 1. Download and extract the prebuilt archive for your platform.
 2. Obtain an API key from one of the following email services: MailGun (free, recommended), Sendgrid (free), or Mandrill (trial/paid). Instructions for each service can be found below.
 3. Open the configuration file `config.json` and set the `apikey` value to the one you obtained from step 2. Then, set the `service` key to `mailgun`, `sendgrid`, or `mandrill` depending on the service your API key belongs to.

----------


Using MailGun for Email Sending (Free)
------------------------------------------------------------

Watchit supports the [MailGun](https://mailgun.com/) email service, which offers a free plan of 10,000 emails a month. If you already have a MailGun account, sign in and then skip. Otherwise, to get a free MailGun account and a corresponding API key, do the following:

 1. [Register a new account for MailGun.](https://mailgun.com/signup) Please do not use fake or invalid information.
 2. On the *Success!* page, scroll down and click *Continue to your control panel*.
 3. The next page should show an orange banner at the top asking for email verification. Sign in to the email account you signed up with and click on the activation link sent to you by MailGun.
 4. With your account activated, open the [MailGun control panel](https://mailgun.com/app/dashboard) and scroll down to the *API Keys* box in the lower right. Click on *Show* next to the *Secret API key* to reveal your API key. Copy it to your clipboard.
 5. Open the `config.json` file in the Watchit root directory. In the `apikey` key-value pair, replace the value `paste-your-api-key-here` with the API key from step 4.
 6. Make sure the `service` key is set to `mailgun`. You're all set!

If you do not own the domain name you plan to send emails with, Mailgun will limit you to 300 emails a day. If you own a domain name, it is strongly recommended that you [register your domain with Mailgun](https://mailgun.com/app/domains/new) to avoid having your emails marked as spam or phishing attempts.


----------


Using SendGrid for Email Sending (Free)
---------------

Watchit supports the [SendGrid](https://sendgrid.com/) email service, which offers a free plan of 12,000 emails a month. If you already have a SendGrid account, sign in and then skip to step 4. Otherwise, to get a free SendGrid account and a corresponding API key, do the following:

 1. Visit the [SendGrid pricing page](https://sendgrid.com/pricing) and scroll all the way to the bottom. Choose the *Free Plan* option and register a new account. Then, visit the link in the account email confirmation.
 3.  Fill out and submit the registration information. (Ideally, you will have your own unique website/domain to register with)
 4. You will now be signed in. At the top, there will be an account provision warning. It should be automatically provisioned in a few minutes (usually up to an hour) and you will get an email when this happens.
 5. Click on *Settings* on the left menu, and then *API Keys*.
 6. Click *Create API Key* button. Give it a name and click *Save*.
 7. You will now be presented with a text API key. Copy this to your clipboard.
 8. Open the `config.json` file in the Watchit root directory. In the `apikey` key-value pair, replace the value `paste-your-api-key-here` with the API key from step 7.
 9. Make sure the `service` key is set to the value `sendgrid`. You're all set!

If you lose or forget your SendGrid API key, you can always create a new one by repeating steps 4-6. If you own a domain name, it is highly recommended that [you register your domain with 
SendGrid](https://sendgrid.com/docs/User_Guide/Settings/Whitelabel/domains.html). This will reduce the likelihood of your emails appearing as spam or as phishing attempts.


----------


Using Mandrill for Email Sending (Trial/Paid)
----------

Watchit supports the [Mandrill](https://mandrill.com/signup/) email service, but they no longer offers a free plan. They offer 2000 free trial sends and then monthly volume based pricing afterwards. Their sign up process is the easiest of all services supported by Watchit:

 1. [Register a new account for Mandrill](https://mandrill.com/signup/). You will immediately be signed in.
 2. Complete, or skip, the detailed registration information. Then, click on the *Settings* tab in the left column.
 3. The SMTP & API Credentials page should open. Click on the *Add API Key* button.
 4. A new API key will be generated and appear in the *Key* column of the list. Copy this to your clipboard.
 5. Open the `config.json` file in the Watchit root directory. In the `apikey` key-value pair, replace the value `paste-your-api-key-here` with the API key from step 4.
 6. Make sure the `service` key is set to the value `mandrill`. You're all set!

If you own a domain name, it is highly recommend that you [register your domain with Mandrill](https://mandrillapp.com/settings/sending-domains) for sending. This will reduce the likelihood of your emails appearing as spam or phishing attempts.

Configuration Guide
----------

Watchit is configured by a single configuration file, `config.json`. The usage of the root level key/value pairs are defined as follows:

 - `service` : The email service used to deliver emails. Three email services are supported: MailGun, SendGrid, and Mandrill. Valid values are `mailgun`, `sendgrid`, and `mandrill`, respectively.
 - `apikey` : The API key string for the email provider indicated in `service`.
 - `defaultEmailTemplate` : The default email template used when composing notification emails. See the **Email Templates** guide below for more information.
 - `watchers` : An array of Watchers. See the **Watchers** guide below for more information.

**Defining Watchers**

Each unique subreddit for Watchit to track must be assigned a *Watcher*. Watchers have their own individual properties, which will affect the formatting of their notification emails, the frequency with which they check Reddit, and more:

 - `subreddit` : The target subreddit for this Watcher. The value should be a string that refers to the subreddit name.
 - `emailTemplate` : (Optional) The email template used when composing and sending notification messages. If no value is provided, the `defaultEmailTemplate` is used.
 - `interval` : (Optional) How frequently the Watcher will check the subreddit, in milliseconds. If no value is provided, the default value is `60000`, or 1 minute. The minimum possible interval is `5000`, or 5 seconds.
 - `filters` : (Optional) An array of filters for this Watcher. If no filters are provided, all new posts (posts not seen before by this `Watcher`) found on each interval will fire a notification. Check out the **Filters** guide below for more information.

**Email Templates**

Email templates describe the notification emails sent out by Watchit. 
Each time a `Watcher` checks a subreddit, it will filter posts from the *New* queue in chronological order. If any posts (that
pass the filters) have not been seen by that `Watcher` before, Watchit will immediately compose and send a notification email
describing those posts. 

Email templates require the following properties:

 - `from` : The email sender's address, in other words, the address that emails appear to be from. 
 It is possible to use any email address here, but if you use an address with a domain you do not own, emails may show up
 in your inbox as spam or phishing attempts.
 - `to` : The destination/target email address for notification emails. 
 - `subject` : The subject/title of notification emails. Titles longer than 77 characters will be truncated to 74 characters
 and have ellipsis (...) appended to the end.
 - `body` : The body contents of notification emails. Raw HTML is supported. A special `{posts}` substitution inserts 
 all the new, filtered posts, each described by the `post` property (see below).
 - `post` : A template for describing each post. Raw HTML is supported. The `{posts}` substitution usable in the `body` property
 inserts all the new, filtered posts as described by this template concatenated together.

**Filters**

Filters allow `Watchers` to notify and report only on a subset of subreddit posts. For example, you may only wish to receive notifications for posts that have more than 10 comments, or posts containing "cat" in the title, or even posts made by specific users. 

# For Developers

To run Watchit from source, you will need to have [Node.js installed.](https://nodejs.org/download/) Clone the Watchit repository, setup your `config.json` (see above), and run Watchit with the following terminal command:

`node main.js`

**Launch Options/Arguments**

 - `--key [your-API-key]` (short: `-k`): Overrides the API key provided in `config.json` with the one provided.
 - `--debug [number]` (short `-d`): Enable additional debug messages. The higher the number (up to 3), the more messages are printed to the console. The default value is 0.
 - `--log` (short `-d`): Enables logging console output to a local file, `Watchit.log`.
 - `--silent` (short `-s`): Enables silent mode, which turns off all console output. This does not affect logging output, if it is enabled.
 - `--service [your-email-service]`: Overrides the service name provided in `config.json` with the one provided.

**How to compile Watchit into a standalone binary executable**

[JXcore](http://jxcore.com/) is used to package Watchit into a standalone binary executable. With JXcore installed (or in the same directory as the current directory), run the terminal command:

`jx package main.js "Watchit" -native -slim config.json`

This will package all files excluding `config.json`, which should be kept outside so it is available for editing, into a standalone binary executable file `Watchit` or `Watchit.exe` on Windows.
