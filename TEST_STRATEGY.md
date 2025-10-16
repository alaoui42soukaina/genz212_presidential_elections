# Test Strategy

## 🤔 Why did you choose your application?

Less than a month ago, a Moroccan youth led movement called GENZ212 started nation wide protests against the dire conditions of healthcare and education in Morocco. This movement is organised on Discord and has no defined leadership, it is inherently decentralized. The movement calls for the prime minister to step down which opened a discussion about how could we organise the election of a new government online and the idea of using a blockchain app was brought up, hence my inspiration.

## ⚠️ What are the main risks for this application?

The first risk I see of this application is due to the fact that live votes, although hidden in the front end, are immediately accessible in the blockchain which could potentially interfere with the democratic process of voting and create bias for those who have not voted yet. I think using Zama would have been perfect in this situation as votes can be recorded but their content encrypted while the election is ongoing and can then be decrypted once it ends, that way we preserve both transparency and democarcy.

Other than that, I'm not super familiar with technical implementation but voter anonymity in this current app is not protected as well as the admin account is too vulnerable, it can be a single point failure.

## 🧪 How did you structure your tests and why? What are you testing at each level?

I structured my tests according to the test pyramid and divided them into unit (most amount of tests), integration and E2E (least amount of tests).

The bulk of code validation should be unit tests, as these are primarily owned by developpers, I just quickly generated them with AI assistance, ran test coverage verification and added missing tests where needed. Again with AI assistance, I made sure that they include the verification of on chain events and state changes for each function and I stopped my polishing there.
The purpose of these unit tests is to make sure that that functions in each contract are operating as expected individually, the kind of bugs they could detect are mostly technical errors.

Integration tests serve to verify that all the different contracts work together as expected, here I focused on making sure that contracts are correctly well deployed, that the data retrieved from one contract is coherent with data retrieved from another and I also made sure to verify the most risky scenarios that could lead to critical bugs. Here we can detect technical integration errors and potential vulnerabilities in business contraints. On this level I made sure to include clear error reporting to give more context when failures are not self evident.

On my E2E test, I tested the entire happy path of my app. Again here, I made sure my reporting is clear and provides enough context throughout the tests's actions. I also made sure to validate that the events and states in the blockchain correspond well to the actions of the E2E test. This kind of testing usually detects business logic bugs and regressions.

Furthermore, I created a common helper in order to be able to re-use common logic throughout the different test scripts and included static code testing with linter and also added code format checking with prettier.

## ⏳ If I had more time: What would you extend or polish in your test suite, and why?

- As I have taken the time to build a UI, using playwright for web testing would have been good and I could have included lighthouse for performance, accessibility etc.
- I would have taken more time to figure out which framework would have been best for this test suite, Mocha or Playwright. I'm not super familiar with Mocha, it seemed to be the straightforward choice as it is in JS and has built-in integration with hardhat. But, I faced a limitation with retry logic and timeout config that didn't work so well (I ended up implementing this in the CI instead) and and with parallelisation that caused reporting to fail so I had to run my tests sequentially. Playwright handles this much better but you would have to re-write some code to make it fit with hardhat and you could lose some features in the process.
- I would have liked to explore perf testing, stress testing and gas optimisation in the context of the blockchain.
- Right now my github action doesn't disable merge if tests are failed, would have liked to enable that feature.
- Ideally, the test results would be integrated with a slack webhook reporting directly to the team and with a test management tool (like Qase.io) to store test execution results and logs.

## 🤖 AI coding assistance: If you used tools like Copilot or ChatGPT, what worked well and what did not for this task?

I used Cursor mainly, it was really good with providing a base layer of a functional dApp that suited my needs and I used it to iterate on how I wanted the app to be designed. It was messily written though, one big file including all the html, CSS and javascript so I had to orchestrate to better organise the codebase. The code also consisted of lots of repetition and hard coded values so I needed to parametrise and refactor. In short, you get a working MVP but you need to polish for good, maintainable design.

It also used the AI to ask lots of questions about the dApp to understand better how it works from a technical standpoint as it is new for me, so it served as a good learning tool.

It was also useful for troubleshooting whenever I ran into errors but sometimes the fixes can be overkill and iterative fixes can compile leaving you with lots of code change while one single targeted fix could have taken care of the problem, so I needed to keep cleaning up to make sure that I'm only pushing the minimal necessary code and get rid of all the noise.
