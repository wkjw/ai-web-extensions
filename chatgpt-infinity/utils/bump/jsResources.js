#!/usr/bin/env node

// Bumps @require'd JS in userscript
// NOTE: Doesn't git commit to allow potentially required script editing

(async () => {

    const repoName = 'chatgpt-infinity',
          userJSfilePath = `./greasemonkey/${repoName}.user.js`

    // Import LIBS
    const fs = require('fs'), // to read/write files
          ssri = require('ssri') // to generate SHA-256 hashes

    // Init UI COLORS
    const nc = '\x1b[0m',    // no color
          by = '\x1b[1;33m', // bright yellow
          bg = '\x1b[1;92m', // bright green
          bw = '\x1b[1;97m'  // bright white

    // Define FUNCTIONS

    const log = {
        info(msg) { console.log(bw + msg + nc) },
        working(msg) { console.log(by + msg + nc) },
        success(msg) { console.log(bg + msg + nc) }
    }

    function fetchData(url) {
        if (typeof fetch == 'undefined') // polyfill for Node.js < v21
            return new Promise((resolve, reject) => {
                try { // to use http or https module
                    const protocol = url.match(/^([^:]+):\/\//)[1]
                    if (!/^https?$/.test(protocol)) reject(new Error('Invalid fetchData() URL.'))
                    require(protocol).get(url, res => {
                        let rawData = ''
                        res.on('data', chunk => rawData += chunk)
                        res.on('end', () => resolve({ json: () => JSON.parse(rawData) }))
                    }).on('error', err => reject(new Error(err.message)))
                } catch (err) { reject(new Error('Environment not supported.'))
            }});
        else // use fetch() from Node.js v21+
            return fetch(url)
    }

    async function getSRIhash(url, algorithm = 'sha256') {
        return ssri.fromData(
            Buffer.from(await (await fetchData(url)).arrayBuffer()), { algorithms: [algorithm] }).toString()
    }

    function bumpUserJSver(userJSfilePath) {
        const date = new Date(),
              today = `${date.getFullYear()}.${date.getMonth() +1}.${date.getDate()}`, // YYYY.M.D format
              re_version = /(@version\s+)([\d.]+)/
        let userJScontent = fs.readFileSync(userJSfilePath, 'utf-8')
        const currentVer = userJScontent.match(re_version)[2] ; let newVer
        if (currentVer.startsWith(today)) { // bump sub-ver
            const verParts = currentVer.split('.'),
                  subVer = verParts.length > 3 ? parseInt(verParts[3], 10) +1 : 1
            newVer = `${today}.${subVer}`
        } else // bump to today
            newVer = today
        userJScontent = userJScontent.replace(re_version, `$1${newVer}`)
        fs.writeFileSync(userJSfilePath, userJScontent, 'utf-8')
        console.log(`Updated: ${bw}v${currentVer}${nc} → ${bg}v${newVer}${nc}\n`)
    }

    // Run MAIN routine

    log.working('\nCollecting JS resources...\n')
    const userJScontent = fs.readFileSync(userJSfilePath, 'utf-8'),
          re_jsrURL = /^\/\/ @require\s+(https:\/\/cdn\.jsdelivr\.net\/gh\/.+$)/gm,
          jsrURLs = [...userJScontent.matchAll(re_jsrURL)].map(match => match[1])
    log.success(`${jsrURLs.length} bumpable resource(s) found.`)

    log.working('\nProcessing resource(s)...\n')
    let jsrUpdatedCnt = 0

    // Fetch latest commit hash
    console.log('Fetching latest commit hash...')
    const latestCommitHash = require('child_process').execSync(
        `git ls-remote https://github.com/adamlui/${repoName}.git HEAD`).toString().split('\t')[0]
    console.log(latestCommitHash + '\n')

    // Process each resource
    const re_commitHash = /@([^/]+)/ ; let fileUpdated = false
    for (const jsrURL of jsrURLs) {
        const resourceName = jsrURL.match(/\w+\/\w+\.js(?=#|$)/)[0] // dir/filename.js for logs

        // Compare commit hashes
        if ((jsrURL.match(re_commitHash) || [])[1] == latestCommitHash) { // commit hash didn't change...
            console.log(`${resourceName} already up-to-date!\n`) ; continue } // ...so skip resource
        let updatedURL = jsrURL.replace(re_commitHash, `@${latestCommitHash}`) // othrwise update commit hash

        // Generate/compare SRI hash
        console.log(`Generating SHA-256 hash for ${resourceName}...`)
        const newSRIhash = await getSRIhash(updatedURL)
        console.log(`${newSRIhash}\n`)
        const oldSRIhash = (/[^#]+$/.exec(jsrURL) || [])[0]
        if (oldSRIhash == newSRIhash) { // SRI hash didn't change
            console.log(`${resourceName} already up-to-date!\n`) ; continue } // ...so skip resource
        updatedURL = updatedURL.replace(/#sha.+/, newSRIhash) // otherwise update SRI hash

        // Write updated URL to userscript
        console.log(`Writing updated URL for ${resourceName}...`)
        let userJScontent = fs.readFileSync(userJSfilePath, 'utf-8')
        userJScontent = userJScontent.replace(jsrURL, updatedURL)
        fs.writeFileSync(userJSfilePath, userJScontent, 'utf-8')
        log.success(`${resourceName} bumped!\n`)
        jsrUpdatedCnt++ ; fileUpdated = true
    }
    if (fileUpdated) {
        console.log('Bumping userscript version...')
        bumpUserJSver(userJSfilePath)
    }

    // Log final summary
    log[jsrUpdatedCnt > 0 ? 'success' : 'info'](
        `${ jsrUpdatedCnt > 0 ? 'Success! ' : '' }${jsrUpdatedCnt} resource(s) bumped.`)

})()
