var path = require('path');
const program = require('commander')
const inquirer = require('inquirer');
var fs = require('fs'), request = require('request');

    if (process.pkg) {
        var puppeteer = require(path.resolve(process.cwd(), 'puppeteer'));
    } else {
        var puppeteer = require('puppeteer');
    }

let instaAccountName
let showBrowser
let browser
const instaBaseURL = 'https://www.instagram.com/'
const instaLoginURL = 'accounts/login/'

const l4fUser = 'your_user'
const l4fPass = 'your_pass'
let posts = []
let links = []

program
  .command('posts [perfil]')
  .description('Perfil a ser baixado') 
  .action(async (perfil) => {
        let resp

        if(!perfil) {
            resp = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'perfil',
                    message: 'Qual é o perfil alvo?',
                    validate: value => value ? true : 'Não é permitido um perfil vazio'
                },
                {
                    type: 'confirm',
                    name: 'showBrowser',
                    message: 'Mostrar no navegador?',
                    default: false
                }
            ])
        }
        instaAccountName = resp.perfil
        showBrowser = resp.showBrowser
        start()
    })
    .parse(process.argv)

async function start () {    
    //creating page target
    const page = await createPage()
    
    //navigating to target page and waiting she's ready
    await page.goto(instaBaseURL + instaLoginURL, { waitUntil: ['networkidle0', 'domcontentloaded'] })
    
    //fill User Name
    console.log('logando no insta...')
    const inputUserNameSelector = 'input[name="username"]'
    await page.waitForSelector(inputUserNameSelector)
    await page.type(inputUserNameSelector, l4fUser)

    //fill Password
    const inputUserPassSelector = 'input[name="password"]'
    await page.waitForSelector(inputUserPassSelector)
    await page.type(inputUserPassSelector, l4fPass)
    
    //click login button
    const btnLoginSelector = 'button[type="submit"]'
    await page.waitForSelector(btnLoginSelector)
    await page.click(btnLoginSelector)

    //click not now save info
    const btnNotNowSaveInfoSelector = '.cmbtv'
    await page.waitForSelector(btnNotNowSaveInfoSelector)
    await page.click(btnNotNowSaveInfoSelector)

    //goto account target
    console.log(`acessando perfil ${instaAccountName}`)
    await page.goto(instaBaseURL + instaAccountName)

    //scroll page to load more posts
    await scrollDown(page, 10)    

    //get post list
    await mountList(page)

    //navigation posts
    if(posts.length > 0) {
        await makeDir('./fotos');
        const accountDir = `./fotos/${instaAccountName}`
        await makeDir(accountDir);
    }

    console.log('baixando posts...')
    for(var i = 0; i < posts.length; i++) {
        await page.goto(posts[i])
        const btnNextPhotoSelector = '._6CZji'
        const nextButton = await page.$(btnNextPhotoSelector)
        
        const postDescSelector = '.C4VMK > span'
        const postDescText = await page.$(postDescSelector)

        if(nextButton) {
            await nextPhoto(page, btnNextPhotoSelector)
            const photoSelector = '.ekfSF div ul li div > img'
            
            if(await page.$(photoSelector)) {
                const postDir = `./fotos/${instaAccountName}/post_${i+1}`
                makeDir(postDir);

                let spanElement;
                spanElement = await postDescText.getProperty('textContent')

                if(postDescText) {
                    fs.writeFileSync(postDir+'/postDesc.txt', await spanElement.jsonValue())
                }

                links = await page.$$eval(photoSelector, links => links.map(link => link.src))
                
                links.forEach((link, index) => {
                    download(link, postDir+`/photo_${index+1}.jpg`, () => {
                    })
                })
            }
        } else {
            const photoSelectorUnic = '.eLAPa.kPFhm div > img'

            if(await page.$(photoSelectorUnic)) {        
                const postDir = `./fotos/${instaAccountName}/post_${i+1}`
                makeDir(postDir);

                if(postDescText) {
                    fs.writeFileSync(postDir+'/postText.txt', postDescText);
                }
                
                linksUnic = await page.$$eval(photoSelectorUnic, links => links.map(link => link.src))

                linksUnic.forEach((link, index) => {
                    download(link, postDir+`/photo_${index+1}.jpg`, () => {
                    })
                })
            }
        }
    }
    
    await browser.close()
    console.log('imagens baixadas...')    
}

async function scrollDown(page, qtdPageDn) {
    console.log('rolando página de posts...')
    for(var i = 0; i < qtdPageDn; i++) {
        await page.waitFor(200)
        await page.keyboard.press('PageDown');        
    }
}

async function mountList(page) {
    const postsGridSelector = 'div[style*="flex-direction"] div > a'
    posts = await page.$$eval(postsGridSelector, posts => posts.map(post => post.href))
}

async function createPage() {
    browser = await puppeteer.launch({headless: !showBrowser, args: ['--no-sandbox']})
    console.log(await browser.version());
    const page = await browser.newPage();
    await page.setViewport({width: 1200, height: 800});
    return page;
}

async function download(uri, filename, callback){
    request.head(uri, function(err, res, body){
        request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
    })
}

async function makeDir(dir) {
    if(!fs.existsSync(dir)) {
        fs.mkdirSync(dir, (err) => { 
            if (err) { 
                return console.error(err); 
            }            
        });
    } 
}

async function nextPhoto(page, selector) {
    const nextButton = await page.$(selector)

    if(nextButton) {
        await nextButton.click()
        await page.waitFor(100)
        await nextPhoto(page, selector)
    }    
}
