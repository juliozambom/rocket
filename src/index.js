const puppeteer = require('puppeteer');
const jsonfile = require('jsonfile');
require('dotenv').config();

let collectedCoins = 0;
let token = null;

const DISCORD_LOGIN = process.env.DISCORD_LOGIN
const DISCORD_PASSWORD = process.env.DISCORD_PASSWORD

async function revalidateToken({ page, isTheFirstTime }) {
  if (!isTheFirstTime) {
    const exitRocketBotButton = await page.$("[aria-label='Sair da atividade']");
    await exitRocketBotButton.click()
  
    await new Promise((resolve) => setTimeout(resolve, 800))
  }

  const rocketBotRoyaleButton = await page.$(("div[aria-label='Rocket Bot Royale']"));

  await rocketBotRoyaleButton.click();

  await page.tracing.start({
    path: './tracing.json',
  })

  const timeout = 30000;

  await new Promise(resolve => setTimeout(resolve, timeout));

  await page.tracing.stop();

  await new Promise(resolve => setTimeout(resolve, 500));

  let tokenToReturn = null;

  jsonfile.readFile('./tracing.json', async function (err, obj) {
    if (err) console.error(err)

    const objToken = JSON.stringify(obj).split("token=")[1].split('"')[0]

    token = objToken
    tokenToReturn = objToken;
  })

  async function shouldReturnResult() {
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (tokenToReturn) {
      return true
    } else {
      await shouldReturnResult();
    }
  }

  await shouldReturnResult();

  return tokenToReturn;
}

async function collectBonus(token) {
  console.log("Coletando recompensa")

   const response = await fetch("https://dev-nakama.winterpixel.io/v2/rpc/collect_timed_bonus", {
    method: 'POST',
    headers: {
      Accept: "application/json",
      Origin: "https://rocketbotroyale2.winterpixel.io",
      Referer: "https://rocketbotroyale2.winterpixel.io/",
      'User-Agent': "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      'Content-Type': "Content-Type",
      Authorization: `Bearer ${token}`,
    },
    body: '"{}"'
  });

  const json = await response.json()
  console.log(json)

  if(json?.message == "Bonus is not unlocked yet.") {
    console.log("Bonus ja coletado, coletando novamente em 30 minutos")
  } else {
    collectedCoins += 100;
    console.log(`Recompensa coletada, moedas capturadas ao todo ${collectedCoins}`)
  }
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto('https://discord.com/login');

  await page.waitForSelector("input[name='email']")

  const emailInput = await page.$("input[name='email']");
  await emailInput.type(DISCORD_LOGIN, {
    delay: 100
  })

  await page.waitForSelector("input[name='password']");
  const pwdInput = await page.$("input[name='password']");

  await pwdInput.type(DISCORD_PASSWORD, {
    delay: 100
  })

  const submitButton = await page.$("button[type='submit']")
  await submitButton.click()

  console.log("Esperando o Discord carregar")

  await new Promise(resolve => setTimeout(resolve, 20000));

  const firstToken = await revalidateToken({
    page,
    isTheFirstTime: true
  });
  await collectBonus(firstToken)

  setInterval(async () => {
    await collectBonus(token)
    try {
      await revalidateToken({
        page,
        isTheFirstTime: false
      });
    } catch (error) {
      console.log("Error revalidating token: " + error)
    }
  }, 60 * 30 * 1000) // 30 minutes interval
})()