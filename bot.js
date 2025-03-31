const { Telegraf } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf('7551117225:AAG3hPbbu0nP7lgVx0wMkqM34A77bh1xeGc');  // Replace with your bot token

let userData = {};

// Load user data
const loadUserData = () => {
  try {
    const data = fs.readFileSync('userData.json', 'utf8');
    userData = JSON.parse(data);
  } catch (err) {
    console.error('Error loading user data:', err);
  }
};

// Save user data
const saveUserData = () => {
  fs.writeFileSync('userData.json', JSON.stringify(userData, null, 2), 'utf8');
};

// Load user data on bot startup
loadUserData();

// Function to get rank
const getRank = (coins) => {
  if (coins < 100) return 'Newbie Wiz';
  if (coins < 500) return 'Skilled Wiz';
  if (coins < 1000) return 'Elite Wiz';
  if (coins < 5000) return 'Supreme Wiz';
  return 'WizXclusive Legend';
};

// 📌 Command: Check balance
bot.command('balance', (ctx) => {
  const userId = ctx.from.id;
  const coins = userData[userId]?.coins || 0;
  const rank = getRank(coins);
  ctx.reply(`You have ${coins} Wiz Coins. Your rank: ${rank}.`);
});

// 📌 Command: Check rank
bot.command('rank', (ctx) => {
  const userId = ctx.from.id;
  const coins = userData[userId]?.coins || 0;
  ctx.reply(`Your rank is: ${getRank(coins)}`);
});

const ownerId = 5320958997; // Replace with your Telegram User ID

bot.command('setcoins', (ctx) => {
  // Check if the user is the owner (admin)
  if (ctx.from.id !== ownerId) {
    return ctx.reply("❌ You are not authorized to use this command.");
  }

  // Check if the command is a reply to a message
  if (!ctx.message.reply_to_message) {
    return ctx.reply("⚠️ Please reply to a user's message to set their coins.");
  }

  // Get the target user ID (the one being replied to)
  const targetUserId = ctx.message.reply_to_message.from.id;
  // Get the amount from the command (ensure it's an integer)
  const amount = parseInt(ctx.message.text.split(' ')[1], 10);

  // Check if the amount is a valid number
  if (isNaN(amount)) {
    return ctx.reply("⚠️ Invalid amount. Usage: /setcoins <amount> (reply to user)");
  }

  // Initialize user data if the target user doesn't exist in the data
  userData[targetUserId] = userData[targetUserId] || { coins: 0 };

  // If the user is the owner, allow unlimited coins
  if (ctx.from.id === ownerId) {
    userData[targetUserId].coins += amount; // Add unlimited coins to the target user's balance
  } else {
    userData[targetUserId].coins = amount; // Otherwise, set a specific coin amount
  }

  // Save the updated data
  saveUserData();

  // Send confirmation message
  ctx.reply(`✅ Set ${amount} Wiz Coins for ${ctx.message.reply_to_message.from.first_name}.`);
});


// 📌 Command: Gift Coins - Must Reply to a User
bot.command('gift', (ctx) => {
  if (!ctx.message.reply_to_message) return ctx.reply("⚠️ Reply to a user's message to send coins.");

  const targetUserId = ctx.message.reply_to_message.from.id;
  const senderId = ctx.from.id;
  const amount = parseInt(ctx.message.text.split(' ')[1], 10);

  if (isNaN(amount) || amount <= 0) return ctx.reply("⚠️ Invalid amount. Usage: /gift <amount> (reply to user)");

  if (!userData[senderId] || userData[senderId].coins < amount) {
    return ctx.reply("❌ You don't have enough Wiz Coins.");
  }

  userData[senderId].coins -= amount;
  userData[targetUserId] = userData[targetUserId] || { coins: 0 };
  userData[targetUserId].coins += amount;
  saveUserData();

  ctx.reply(`🎁 You sent ${amount} Wiz Coins to ${ctx.message.reply_to_message.from.first_name}.`);
});

// Command to display the leaderboard with user names
bot.command('top', (ctx) => {
  // Sort users by coins in descending order
  const sortedUsers = Object.entries(userData)
    .sort((a, b) => b[1].coins - a[1].coins)
    .slice(0, 10);  // Top 10 users

  if (sortedUsers.length === 0) {
    return ctx.reply("⚠️ No users found in the leaderboard.");
  }

  let leaderboardMessage = 'Leaderboard:\n';

  // Loop through sorted users and get their names from the stored data
  sortedUsers.forEach(([userId, data], index) => {
    // Try to get the user's first name and username from userData
    const username = userData[userId]?.username || `User ${userId}`;  // Fallback to userId if no username found
    leaderboardMessage += `${index + 1}. ${username}: ${data.coins} Wiz Coins - Rank: ${getRank(data.coins)}\n`;
  });

  // Send the leaderboard message
  ctx.reply(leaderboardMessage);
});

// Command to gamble coins with a 10-minute limit
bot.command('gamble', (ctx) => {
  const userId = ctx.from.id;
  const amount = parseInt(ctx.message.text.split(' ')[1], 10);

  if (isNaN(amount) || amount <= 0) return ctx.reply("⚠️ Invalid amount. Usage: /gamble <amount>");

  if (!userData[userId]) {
    userData[userId] = { coins: 0, lastGamble: 0 }; // Initialize user data
  }

  // Check if 10 minutes have passed since the last gamble
  const now = Date.now();
  const timeDiff = now - userData[userId].lastGamble;
  const tenMinutesInMs = 10 * 60 * 1000;

  if (timeDiff < tenMinutesInMs) {
    const remainingTime = Math.floor((tenMinutesInMs - timeDiff) / 1000);
    return ctx.reply(`⚠️ You must wait ${remainingTime} seconds before you can gamble again.`);
  }

  if (userData[userId].coins < amount) {
    return ctx.reply("❌ You don't have enough Wiz Coins.");
  }

  const win = Math.random() < 0.5; // 50% chance to win
  if (win) {
    userData[userId].coins += amount;
    ctx.reply(`🎉 You won! Your new balance is ${userData[userId].coins} Wiz Coins.`);
  } else {
    userData[userId].coins -= amount;
    ctx.reply(`😢 You lost! Your new balance is ${userData[userId].coins} Wiz Coins.`);
  }

  // Update the last gamble time
  userData[userId].lastGamble = Date.now();

// 📌 Command: Daily Reward (Users Can Claim Once Per Day)
const dailyCooldown = {};

bot.command('daily', (ctx) => {
  const userId = ctx.from.id;
  const now = Date.now();
  
  if (dailyCooldown[userId] && now - dailyCooldown[userId] < 86400000) { // 24 hours
    return ctx.reply("⏳ You've already claimed your daily reward. Try again tomorrow!");
  }

  userData[userId] = userData[userId] || { coins: 0 };
  userData[userId].coins += 50; // Give 50 coins daily
  dailyCooldown[userId] = now;
  saveUserData();

  ctx.reply("🎁 You've claimed 50 Wiz Coins for today!");
});

// 📌 Earn 1 Coin Per Message (Excluding Commands)
bot.on('message', (ctx) => {
  if (ctx.message.text.startsWith('/')) return; // Ignore commands

  const userId = ctx.from.id;
  userData[userId] = userData[userId] || { coins: 0 };
  userData[userId].coins += 1;
  saveUserData();

  console.log(`User ${userId} earned 1 Wiz Coin. Total: ${userData[userId].coins}`);
});

// Start bot
bot.launch();

// Save user data every 10 minutes
setInterval(saveUserData, 600000);
