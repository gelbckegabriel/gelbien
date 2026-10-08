import type { GuideContent } from ".";

const en: GuideContent = {
  start: {
    title: "Getting started",
    summary: "What Gelbien is, where your data lives, and the first things to set up.",
    intro: [
      "Gelbien helps you see where your money goes and decide where it should go. You log what you spend, give each month a budget, list the bills that repeat, and save towards goals. In return you get a clear picture of every month: what's left, what's coming and what to change.",
      "Your data lives in a Google Sheet in your own Google Drive, called **Gelbien — your name**, created the first time you sign in. Gelbien can only open the files it creates, not the rest of your Drive, and it never asks for bank passwords. Everything you save goes into that sheet, so it's yours to open, back up or delete.",
      "Just curious? **Explore the demo** on the sign-in page loads sample data that stays in your browser. You can sign in with Google later from Profile.",
    ],
    steps: [
      { title: "Sign in with Google", body: "On the sign-in page, choose **Continue with Google** and keep the Google Drive permission checked: Gelbien needs it to create its spreadsheet. This happens once; after that you go straight to your dashboard." },
      { title: "Choose your language and currency", body: "Go to **Profile → Preferences**. Pick English, Português or Français, and the currency every amount is shown in. Both are saved in your sheet, so every device you use follows them." },
      { title: "Set your income and a budget", body: "On the **Budget** page, type your monthly net income and a spending limit for the categories you care about. Not sure what limits to use? **Suggest from last 3 months** works once you've logged a few weeks of expenses. See Budget below." },
      { title: "List your recurring bills", body: "Rent, phone, insurance, streaming: add them under **Recurring expenses** on the Budget page. Gelbien then reminds you when they're due and sets that money aside in your budget before it leaves." },
      { title: "Log expenses as they happen", body: "Tap the gold **+** button whenever you spend. It takes a few seconds, and the more consistently you do it, the more useful every chart, insight and suggestion becomes." },
      { title: "Optional: add your accounts and a goal", body: "On the **Goals** page, add your bank accounts and cards, then a goal such as a trip or a car. Once a month you update the balances, and Gelbien shows your net worth and when you'll reach each goal." },
    ],
    tips: [
      "The **month picker** at the top of every page sets the month you're looking at. The dashboard, budget and expense list all follow it. Tap the month name to jump to any month, or **This month** to come back.",
      "To come back to this guide: on a phone, tap your picture at the top right, then **Guide**; on a computer, use the **?** button at the top of every page, or **Guide** in the sidebar. It opens at the section for the page you were on.",
      "Gelbien works on phones and computers. On a phone, use your browser's **Add to Home Screen** to open it like an app.",
      "If a save fails (no connection, Google storage full…), Gelbien tells you why and keeps what you typed so you can try again. Nothing is lost.",
    ],
  },

  add: {
    title: "Adding an expense",
    summary: "The + button, receipts and AI, splitting a purchase, refunds and edits.",
    intro: [
      "Logging an expense is what you'll do most, so it's built to take seconds. Open the **New expense** form with the gold **+** button (bottom right on a computer, bottom centre on a phone), the **Add expense** button in the sidebar, or by pressing **N** on your keyboard anywhere in the app.",
      "Only the amount and the category are required. Everything else makes your charts and suggestions sharper, and much of it fills itself in.",
    ],
    steps: [
      { title: "Amount and date", body: "Type the amount. The date starts as today; change it if you're catching up on something from earlier. Future dates aren't allowed: log things when they happen." },
      { title: "Merchant and description", body: "**Merchant** is where you paid (Costco, Uber, your landlord); **Description** is what it was (weekly groceries, ride home). If you've bought from that merchant before, leaving the field fills in the category, subcategory, payment method, type and priority you used last time. You'll see \"Filled from your history at…\"." },
      { title: "Category and subcategory", body: "Tap a category. If it has subcategories (Groceries → Supermarket, Bakery…), they appear below for a finer split; picking one is optional. Choosing a category also sets the type and priority you usually pick for it. You can change categories on the Categories page." },
      { title: "Payment, type and priority", body: "**Payment** is the card or account you used; the last one is preselected. **Type**: Fixed for costs that are the same every month (rent, phone plan), Variable for those that change (groceries, eating out). **Priority**: Essential (you need it), Important (valuable but flexible) or Superfluous (nice to have). Be honest with priorities: they power the Essential vs. superfluous chart and the advice in your month review." },
      { title: "Save", body: "**Save** closes the form. On a computer, **Save & add another** keeps it open for the next one. Every save shows an **Undo** for a few seconds, in case you tapped too fast." },
      { title: "Scan a receipt (optional)", body: "At the top of the form, drop, attach or paste a photo or PDF of a receipt. On a phone, **Camera** takes a picture. You can also paste a receipt (Ctrl/⌘+V) or drag a file onto any page to start a new expense with it. With an AI provider connected in Profile, Gelbien reads the amount, date, merchant, category and more. Fields it filled are tagged **AI**, and the ones it wasn't sure about get a ⚠ so you know what to check. Keep **Save to my Drive** on to store the receipt in a \"Gelbien Receipts\" folder in your Drive, or turn it off to use the receipt only to fill in the form." },
      { title: "Split one purchase across categories", body: "One receipt, several kinds of spending, like groceries plus a sweater at Costco? Tap **Split** above the categories. Give each part a category and an amount (optionally item names); the total is the sum of the parts, and each part counts in its own category's budget. **Single category** merges them back into one." },
      { title: "Notes, recurring expenses and refunds", body: "Tap **+ Notes · recurring expense · refund** for the extras. **Notes**: anything you want to remember. **Recurring expense**: links this payment to one of your recurring bills, or adds it to the Budget page as a new one (see Recurring bills). **This is a refund**: money that came back to you; it reduces your spending in that category and shows in green." },
      { title: "Edit or delete", body: "Tap any expense (in the Expenses list, or in lists like Top expenses) to open it again. Change what you need and save, or use the trash button to delete it. Deleting asks for confirmation and offers Undo." },
    ],
    tips: [
      "No AI connected? Everything still works; you just type the fields yourself.",
      "AI requests go straight from your browser to the provider you chose. Your key is stored only in your browser.",
      "Log in the moment, even roughly. A rough expense today is worth more than a perfect one you forget.",
    ],
  },

  dashboard: {
    title: "Dashboard",
    summary: "Your month at a glance: what's left, what's due and where the money went.",
    intro: [
      "The dashboard answers one question: how am I doing this month? Everything on it follows the month picker at the top and updates as soon as you add an expense. Here it is from top to bottom.",
    ],
    steps: [
      { title: "Banners: things to do now", body: "They only appear when needed. **Time for your monthly check-in** asks you to update account balances (see Goals). **\"Month\" is over: here's how it went** opens the review of the month that just ended. **Were these paid?** lists recurring bills charged recently with no expense logged: tap **Paid** (or **All paid**) to log them, or ✕ to skip one this time." },
      { title: "The big number: spent this month", body: "How much you've spent against your budget, how much is **left**, and how much of that is already promised to bills still to pay. The line \"…/day available for the next N days\" is your daily allowance: spend less than that each day and you'll finish the month on budget. For a past month it shows the final result." },
      { title: "The tiles", body: "**Saved** (or **Deficit**): net income minus spending, with your savings rate. **Daily average** of your spending. **Superfluous**: what went to things you marked superfluous. **Runway**: how many months your savings would last if you kept spending more than you earn (it needs your accounts in Goals; **Sustainable** means your income covers your spending). Then **Fixed costs**, number of **Transactions**, **Recurring / mo** (bills and subscriptions per month) and what you've spent this year." },
      { title: "Insights", body: "Short notes on what stands out: a category over budget, spending ahead of pace, a category up or down compared with your usual, a free trial about to end. With AI connected, **Ask AI for insights** adds a personalised read of your month." },
      { title: "The charts", body: "**Spending pace**: your cumulative spending against the planned pace and against last month. The planned pace puts each recurring bill (and any fixed cost you've logged) on the day it's due and spreads the rest of your budget evenly, so rent on the 1st shows up as a step at the start instead of making you look ahead of pace all month. **Where it went**: each category's share. **Budgets by category**: spent vs. limit. **Upcoming bills**: the next 30 days (tick ✓ to log one you've already paid). **12-month trend**: income, spending and savings by month. **Daily spending**: a calendar where brighter means a heavier day. **Money flow**: from income to categories and savings. Then **Essential vs. superfluous**, **Payment methods**, **Top expenses**, **Savings projection**, **By weekday** and **Year at a glance**." },
    ],
    tips: [
      "Every chart has a table button in its corner that swaps the picture for the exact numbers.",
      "Charts show your biggest categories and group the rest as \"Everything else\" so they stay readable.",
      "Look at past months with the month picker: the dashboard becomes a summary of that month.",
    ],
  },

  expenses: {
    title: "Expenses",
    summary: "Everything you've logged: search, filter, edit, delete or export.",
    intro: [
      "The Expenses page lists everything you've logged, grouped by day with each day's total. The header shows how many expenses match and what they add up to. It starts on the month selected at the top; switch to **All time** to search your whole history.",
    ],
    steps: [
      { title: "Find an expense", body: "Type in the search box to match descriptions, merchants and notes. Narrow the list by category, priority or payment method, and sort by **Newest first** or **Largest first**. **Clear filters** brings everything back." },
      { title: "Read a row", body: "Each row shows the description, its subcategory (or category), the merchant and payment method, the amount and its priority. Small icons mark recurring expenses (↻), purchases split across categories, and attached receipts (📎). Refunds appear in green." },
      { title: "Edit or delete", body: "Tap a row to open it in the expense form. Change anything and save, or delete it. A split purchase opens with all of its parts." },
      { title: "Export", body: "**Export CSV** downloads the expenses currently shown, with your filters applied, as a file you can open in any spreadsheet app." },
    ],
    tips: [
      "On the Budget page, tapping a category opens this list already filtered to that category for the month.",
      "Search plus **All time** is the quickest way to answer \"when did I last pay for…?\"",
    ],
  },

  budget: {
    title: "Budget",
    summary: "Your income, a limit per category, and how the month is going against the plan.",
    intro: [
      "A budget is a plan for your income: how much you allow yourself in each category, and what's left to save. Gelbien compares that plan with what you actually spend, all month long, so you can correct course before the month is over instead of finding out afterwards.",
      "A good first budget doesn't need to be perfect. Start from what you really spend, then nudge one or two categories down each month.",
    ],
    steps: [
      { title: "Enter your income", body: "In **Income**, type your monthly **Gross** (before taxes) and **Net** (after taxes). Gelbien uses the net amount, what actually reaches your account, for everything else, and shows the taxes and deductions in between with your effective rate." },
      { title: "Set a limit per category", body: "Under **Spending limits**, type a monthly amount next to each category. Leave a category empty if you don't want a limit for it. The coloured bar shows each category's share of your net income, and the totals show **Planned spending**, **Planned savings** (income minus planned spending, or **Over-allocated** if the plan is bigger than your income) and your savings rate." },
      { title: "Get a head start", body: "**Suggest from last 3 months** fills every limit with your average spending in that category, rounded up to the nearest 10. **Copy last month** copies the previous month's plan. Both only fill the form; nothing is saved until you press Save." },
      { title: "Choose the months it applies to", body: "Next to **Apply to**: **Every month** saves it as your default budget, used by every month that has no plan of its own. **\"Month\" only** saves a custom plan for just this month, for a holiday month say. A month with a custom plan says **Custom budget for this month**, with **Use default** to go back." },
      { title: "Save", body: "Your changes wait in a bar at the bottom of the screen: **Save** them or **Reset** to throw them away. If you try to leave the page or change months first, Gelbien asks whether to save." },
      { title: "Follow the month in Plan vs. actual", body: "This card shows how much of your plan you've spent and what's **left to spend**. The striped part of the bar is bills still to pay this month: money already set aside. The thin vertical marker is where you'd be today at the planned pace (bills on their due day, the rest of the budget spread evenly); if your bar is past it, you're spending faster than planned. Once the month is over, it compares your actual savings with the planned ones." },
      { title: "Check each category", body: "Every limit has a progress bar and a status: **On track**, **Watch out** (past your warning level, 85% of the limit by default, adjustable in Profile) or **Over**. Tap a category to see its expenses for the month. The list starts with where you've spent the most; switch to **Category order** at the top of the card to keep your categories' order (Gelbien remembers your choice)." },
      { title: "Review the month when it ends", body: "When a month is over, open its review from the dashboard banner or from **See the month review** on the Budget page. It shows what you spent and saved, your net worth, and **What to change**: a limit you keep going over (raise it, or plan to cut back), one you never use (lower it and free money for goals), spending with no limit, subscriptions you're unsure about. Then plan vs. actual per category, what changed compared with your usual, and your biggest expenses. **Plan \"next month\"** takes you straight to the next budget." },
    ],
    tips: [
      "Categories without a limit still count in your spending; Plan vs. actual tells you how much went to them.",
      "A simple rule of thumb many people start with: about half of your net income for needs, under a third for wants, and at least a fifth for savings and debt.",
    ],
  },

  recurring: {
    title: "Recurring bills and subscriptions",
    summary: "Rent, utilities and subscriptions: reminders, early payments and the ✓ to log them.",
    intro: [
      "Recurring expenses are payments that repeat: rent, phone, insurance and utilities (**bills**), Netflix, Spotify or the gym (**subscriptions**). Listing them lets Gelbien remind you when each is due, set the money aside in your budget before it leaves your account, and show what they really cost per month and per year.",
    ],
    steps: [
      { title: "Add one", body: "On the Budget page, under **Recurring expenses**, tap **Add recurring**. Choose **Bill** or **Subscription**, then fill in the **Name**, the **Merchant** (who charges you, logged with each payment), the **Amount** and **Billing cycle** (weekly up to yearly), the **Category** and optional **Subcategory**, the **Billing day** (for monthly ones) or **Next charge** date (for other cycles), the **Payment** method and the **Status**: Active, Paused, Cancelled or, for subscriptions, Free trial with the date it ends. Subscriptions also get a **Worth it?** rating." },
      { title: "Or add it while logging an expense", body: "In the expense form, open **+ Notes · recurring expense · refund** and switch on **Recurring expense**. Pick which recurring expense this payment is, or **Add a new one**: it's added to the Budget page with this expense's amount, category and merchant, repeating from its date." },
      { title: "Log each payment", body: "When a bill's date arrives, it appears in **Were these paid?** on the dashboard: tap **Paid** to log it. Paid it early? Tap the ✓ next to it in **Upcoming bills** on the dashboard, or in the **Recurring expenses** list on the Budget page; it's logged today. Logged charges show a green ✓ and the date. Hover over it (or tap it on a phone) to remove that expense; Gelbien asks for confirmation first." },
      { title: "See what they cost", body: "The Recurring expenses card shows your active total per month and per year, and how much of it is subscriptions, usually the easiest place to cut. Free trials are flagged with their end date so you can cancel in time." },
    ],
    tips: [
      "An expense you type yourself counts as paid if it's in the same category and mentions the bill's name or merchant. There's no need to link it by hand.",
      "Bills still to pay this month are taken out of what's left to spend, on the dashboard and in Plan vs. actual.",
      "Pause or cancel a subscription instead of deleting it to keep its history. Paused and cancelled ones stop counting in your totals.",
      "Your month review lists the subscriptions you rated Maybe or No under Worth it?, with what they cost per year.",
    ],
  },

  goals: {
    title: "Goals, accounts and net worth",
    summary: "Save for something specific, track your accounts with a monthly check-in, and watch your net worth.",
    intro: [
      "The Goals page has three parts: your **goals** (a car, a down payment, a trip), your **accounts** (where the money actually is) and your **net worth** (everything you have minus everything you owe).",
      "Gelbien never connects to your bank. Instead, once a month you type in each account's balance, a two-minute **monthly check-in**. That keeps goals, net worth and runway honest without sharing a single password.",
    ],
    steps: [
      { title: "Add your accounts", body: "In **Accounts**, tap **Add account**: a name, the bank or institution, the type and the current balance. Types come in two kinds: what you have (chequing, savings, investments, cash, property such as a home or car, or other) and what you owe (credit card, line of credit, loan, mortgage). For a debt, type the amount you still owe; it's subtracted from your net worth." },
      { title: "Do the monthly check-in", body: "On your check-in day (the 1st by default; change it in the Accounts card), a banner reminds you. Tap **Monthly check-in**, type each balance as your bank app shows it today, and save. **Add reminder to calendar** adds a monthly reminder to your phone or computer calendar." },
      { title: "Create a goal", body: "Tap **New goal**. Give it a name and an icon, a **Target amount** and, if there's a deadline, a **Target date**. Then say where the money is. **In my accounts**: pick the accounts that hold it, and progress follows their balances at every check-in. **Track by hand**: type what you've saved so far and use **Add money** each time you set more aside. Finally, your **Monthly contribution** and **Expected yearly return**; the presets help: Cash (0%), Savings (~3%), Investing (~6%)." },
      { title: "Choose when contributions go in", body: "Under **When contributions go in**, a goal can start **Now**, **From a month** you pick, or **After a goal**: it waits until another goal is reached and starts the month after, so you can line goals up (the car first, then the trip). **Skip months every year** leaves out the months you can't save, like December for the holidays; tap a month to skip it, tap again to bring it back. While a goal waits or skips, what's already saved keeps earning its return. Every date, \"on track\" and \"needs\" amount on the page takes this into account." },
      { title: "Read a goal card", body: "Each card shows your progress, when you'll reach the target at your current pace and, with a target date, whether you're **On track** or **Behind** and how much per month the goal needs. If it starts later, waits for another goal or skips months, the card says so. When nothing goes in this month, a dashed tag beside the status says why (**Waiting** for another goal, **Starts** in a later month, or **Off this month**) and the progress bar turns striped." },
      { title: "Simulate", body: "**Simulate** lets you play with a goal: a bigger monthly contribution, a different return, a one-time deposit, another target or date, a different start or skipped months, or cutting part of your superfluous spending. It compares the scenario with your current plan (\"8 months sooner\"). **Apply to goal** saves it; nothing changes until you do." },
      { title: "Check the monthly plan", body: "**Monthly plan** puts what your goals need each month next to what your budget plans to save and what you've actually been saving lately. If your goals need more than you save, it tells you by how much, so you can adjust a goal or your budget. Only the goals that get a contribution this month count; the ones that start later, wait for another goal or skip this month are listed under **Nothing this month**." },
      { title: "Watch your net worth", body: "**Net worth** shows your assets, your debts and the total, month by month, starting from your first check-in. It's the single best number for long-term progress." },
    ],
    tips: [
      "Closed an account? Mark it **Closed / hidden** instead of deleting it, so your history stays intact.",
      "The dashboard's **Runway** tile and **Savings projection** chart use these balances.",
    ],
  },

  chat: {
    title: "Chat",
    summary: "Ask questions about your money in plain words, answered from your own data.",
    intro: [
      "Chat is an AI assistant that reads your expenses, budget, recurring payments, accounts and goals before answering. Ask what you'd ask a friend who's good with money: \"How much did I spend eating out this month?\", \"Where could I cut $200 next month?\", \"Which subscriptions should I reconsider?\", \"Am I on track for my savings goal?\"",
    ],
    steps: [
      { title: "Connect an AI provider", body: "Chat needs AI. In **Profile → AI assistant**, choose **Claude** (pay-as-you-go with your own key from console.anthropic.com, usually a few cents per question) or **Gemini (free)** (a free key from aistudio.google.com, no card needed). Paste the key and tap **Test connection**." },
      { title: "Ask", body: "Type a question, or tap one of the suggestions to start. Answers appear as they're written; **Stop** ends one early. Follow-up questions keep the context of the conversation." },
      { title: "Start over", body: "**New chat** clears the conversation. Chats are kept in this browser only." },
    ],
    tips: [
      "The same AI connection also reads receipts, writes dashboard insights and helps translate categories.",
      "Requests go straight from your browser to the provider; your key never touches Gelbien's server.",
      "On Gemini's free tier, Google may use your prompts, including your spending data, to improve its products.",
      "AI can make mistakes and isn't financial advice. Double-check important numbers on the dashboard or the Budget page.",
    ],
  },

  categories: {
    title: "Categories and payment methods",
    summary: "Organise spending your way: categories, subcategories, icons, colours, order and payment methods.",
    intro: [
      "Categories decide how your spending is grouped everywhere: budgets, charts and the expense form. Gelbien starts you with a sensible set; make it yours on the **Categories** page (in the sidebar on a computer, or behind your picture at the top right on a phone).",
      "A good set of categories is small enough to pick from in a second (around 10–15) and matches the decisions you want to make. Use subcategories for detail instead of adding more categories.",
    ],
    steps: [
      { title: "Rename, recolour, change the icon", body: "Tap a category's name to rename it; every expense and budget that uses it is updated too. Tap its icon to choose a colour and an icon." },
      { title: "Subcategories", body: "Tap the arrow on a category to open it, then add subcategories (Groceries → Supermarket, Bakery, Butcher). Tap a subcategory to rename it (press Enter to keep the new name, Esc to cancel); every expense and recurring expense that uses it is updated when you save. ✕ removes one." },
      { title: "Change the order", body: "Use the up and down arrows. It's the order of the category buttons in the expense form, so put the ones you use most at the top." },
      { title: "Add, hide or delete", body: "**Add category** creates a new one. **Hide** keeps a category out of the expense form while keeping its history. **Delete category** removes it, or hides it instead if expenses already use it, so your history stays intact." },
      { title: "Payment methods", body: "On the right (below, on a phone) are the cards and accounts you pay with. Add new ones, rename them (past expenses and recurring payments are updated too), tap an icon to change its look, reorder them with the arrows (the first one is the default for new recurring expenses) or remove one with ✕." },
      { title: "Save", body: "Changes wait in the bar at the bottom until you press **Save**, or **Reset** to undo them." },
      { title: "Translate", body: "Changed the app's language? **Translate categories** renames the built-in categories and payment methods into it and, with AI, the ones you created. You review every name before anything changes." },
    ],
  },

  profile: {
    title: "Profile",
    summary: "Language, currency, AI, your spreadsheet, backups and signing out.",
    intro: [
      "Profile holds your account and settings. On a phone, tap your picture at the top right, then **Profile**; on a computer, use the bottom of the sidebar.",
    ],
    steps: [
      { title: "Account", body: "Shows who's signed in, or Demo. In the demo, **Sign in with Google** switches to your own account. **Categories** is a shortcut to that page. **Sign out** leaves this browser; your data stays safe in your sheet." },
      { title: "Preferences", body: "**Language** and **Currency** apply everywhere and sync to your other devices through your sheet. **Monthly savings goal** is what you'd like to save each month; insights tell you when you reach it. **Warn me when a budget reaches** sets when a category turns to Watch out." },
      { title: "AI assistant", body: "Choose **Off**, **Claude** or **Gemini (free)**, paste your key (**Get a key** opens the provider's page), pick a model and **Test connection**. The key is stored only in this browser, so add it on each device you use." },
      { title: "Your data", body: "**Open in Google Sheets** opens your spreadsheet. **Sync now** re-reads it. **Backup (JSON)** downloads everything and **Expenses (CSV)** your expenses; **Restore backup** replaces all your data with a backup file. **Import spreadsheet (.xlsx)** reads expenses, categories, budget, income and subscriptions from a Money Sheet–style workbook, then lets you **Add to existing** data or **Replace all data**." },
      { title: "Offline cache", body: "A copy of your data lives in this browser so Gelbien opens instantly. **Clear cache** forgets that copy (your sheet isn't touched) and loads everything fresh, which is handy if something looks out of date. In the demo, **Reset demo data** starts the sample over." },
    ],
  },

  concepts: {
    title: "Key ideas",
    summary: "The terms you'll see in Gelbien, explained.",
    intro: ["A short glossary. If a number on screen ever puzzles you, its explanation is probably here."],
    terms: [
      { term: "Net income", body: "What reaches your account after taxes and deductions. Budgets, savings and the savings rate are all based on it." },
      { term: "Budget (spending limit)", body: "The most you plan to spend in a category in a month. A plan, not a punishment: adjust it when life changes." },
      { term: "Default vs. custom budget", body: "Your default budget applies to every month. A custom budget replaces it for one month only, like December with gifts or a month with a trip." },
      { term: "Planned savings", body: "Net income minus your planned spending: what the budget leaves for saving. If it's negative, the plan is over-allocated." },
      { term: "Savings rate", body: "The share of your net income you didn't spend: (income − spending) ÷ income. A 20% savings rate means you kept $1 of every $5." },
      { term: "Pace", body: "Where your spending should be by today if the month goes to plan: your recurring bills on their due days, plus the rest of the budget spread evenly. Ahead of pace means you're spending faster than that, so expect to end over budget unless you slow down." },
      { term: "On track · Watch out · Over", body: "A category's status: under your warning level, past it (85% of the limit by default), or above the limit. No limit means the category has no budget." },
      { term: "Fixed vs. variable", body: "Fixed costs are the same every month (rent, phone); variable ones change (groceries, fuel). Variable costs are where day-to-day choices make a difference." },
      { term: "Essential · Important · Superfluous", body: "How much you need an expense. Essential: you'd pay it no matter what. Important: valuable, but there's room to choose. Superfluous: nice to have, and the first place to look when you want to save more." },
      { term: "Bill vs. subscription", body: "Both repeat. Bills are obligations (rent, utilities, insurance); subscriptions are services you chose (streaming, apps, gym) and can usually cancel. Only subscriptions get free trials and a Worth it? rating." },
      { term: "Bills still to pay", body: "Recurring charges due later this month with no expense logged yet. Gelbien counts them as already spent when it tells you what's left." },
      { term: "Monthly check-in", body: "Once a month you type each account's balance. It's how Gelbien knows your net worth and goal progress without connecting to your bank." },
      { term: "Net worth", body: "Everything you have (accounts, investments, cash) minus everything you owe (credit cards, loans)." },
      { term: "Runway", body: "If you spend more than you earn, how many months your savings would cover the gap. It counts money you could actually live on (bank accounts, cash and investments, minus cards and lines of credit), not a home, a loan or a mortgage. Sustainable means your income covers your spending." },
      { term: "Expected yearly return", body: "How much a goal's money grows by itself each year: about 0% in cash, a few percent in a high-interest savings account, more (with ups and downs) when invested." },
      { term: "Split purchase", body: "One payment divided between categories, so each part counts in the right budget." },
      { term: "Refund", body: "Money back from a purchase. It's recorded as a negative expense and lowers that category's spending." },
    ],
  },

  faq: {
    title: "Questions",
    summary: "Privacy, your spreadsheet, devices, costs and more.",
    intro: [],
    faq: [
      { q: "Where is my data, and who can see it?", a: "In a Google Sheet in your own Google Drive. Gelbien can only open the files it created, not the rest of your Drive. Nobody else sees your data unless you share the sheet yourself. The demo keeps its sample data in your browser only." },
      { q: "Can I edit the spreadsheet directly?", a: "Yes. Gelbien re-reads it after every change and whenever you sync: the cloud icon at the top on a computer, or on a phone your picture at the top right, then Sync now. Change values freely, but don't rename or delete its tabs, its header row or the id column, or Gelbien won't recognise the layout." },
      { q: "Do I need to connect my bank?", a: "No, and Gelbien will never ask you to: it doesn't take bank credentials at all. You log expenses yourself (or from receipts), and balances come from your monthly check-in." },
      { q: "Does it cost anything?", a: "Gelbien doesn't need any paid service. AI is optional: Gemini has a free tier, and Claude charges a few cents per use to your own key." },
      { q: "Can I use it on my phone and my computer?", a: "Yes. Sign in with the same Google account on both and your data stays in sync through your sheet. If something you just added doesn't show on the other device, sync it (the cloud icon at the top, or your picture → Sync now on a phone). Your AI key is per browser, so add it on each device." },
      { q: "A save failed. Did I lose my changes?", a: "No. Gelbien explains why (no connection, Google storage full, Google busy) and keeps what you typed so you can try again in a moment." },
      { q: "Something looks wrong or out of date.", a: "Sync first (the cloud icon at the top, or your picture → Sync now on a phone). If that doesn't help, Profile → Clear cache loads everything fresh from your sheet. Your sheet itself is never touched." },
      { q: "How do I start the demo over, or leave it?", a: "Profile → Reset demo data starts the sample over. To use your own data, tap Sign in with Google in Profile." },
      { q: "How do I see the welcome tour again?", a: "At the top of this guide, tap Replay the welcome tour." },
      { q: "How do I delete my data?", a: "Your data is the spreadsheet in your Drive: delete it there (and empty the trash), then sign out. To remove Gelbien's access as well, go to your Google Account → Security → Third-party apps & services." },
    ],
  },
};

export default en;
