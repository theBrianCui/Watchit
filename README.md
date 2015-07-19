# Watchit
A Node.js app that watches any number of subreddits and delivers email notifications for new, filtered Reddit posts. It's totally free and is available (self-hosted) for Windows, Mac, and Linux. Features support for...

- **Unlimited subreddits**. Want to get notifications for new posts on both [/r/buildapcsales](https://www.reddit.com/r/buildapcsales/new/) and [/r/gamedeals](https://www.reddit.com/r/gamedeals/new/)? Watchit can check as many subreddits as you want on a single instance, with a unique configuration for each, and will even queue its requests appropriately so it doesn't hog bandwidth.
- **Unlimited filters**. Get notified only for the posts you deem worthy. Configure notifications for posts based on age, votes, and regular expressions in the title, URL, and body of self-posts.
- **Instant email notifications** using SendGrid, up to 12,000 emails a month for free. Or, if you have a Mandrill account, you can use that service instead.
- **Custom HTML email templates** for every subreddit. Be brief and include just post titles and URLs, or include post scores, comment counts, age, and more in your emails.

**How to set up Watchit + SendGrid for email sending**

Watchit supports the [SendGrid](https://sendgrid.com/) service, which offers a free plan of 12,000 emails a month. To get a free SendGrid account and a corresponding API key, do the following:

 1. Visit the [SendGrid pricing page](https://sendgrid.com/pricing) and scroll all the way to the bottom. Choose the *Free Plan* option and register a new account. Then, visit the link in the account email confirmation.
 3.  Fill out and submit the registration information. (Ideally, you will have your own unique website/domain to register with)
 4. You will now be signed in. At the top, there will be an account provision warning. It should be automatically provisioned in a few minutes (usually up to an hour) and you will get an email when this happens.
 5. Click on *Settings* on the left menu, and then *API Keys*.
 6. Click *Create API Key* button. Give it a name and click *Save*.
 7. You will now be presented with a text API key. **This is the key that you will use with Watchit.**
 8. Open the *config.json* file in the Watchit root directory. In the "apikey" key-value pair, replace the value (default "paste-your-api-key-here", without quotes) with the API key from step 7.
 9. Make sure the "service" key is set to the value "sendgrid". You're all set!

If you lose or forget your SendGrid API key, you can always create a new one by repeating steps 4-6.

**How to set up Watchit + Mandrill for email sending**

Mandrill is an alternative to SendGrid. 
