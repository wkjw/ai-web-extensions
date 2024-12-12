// Requires lib/chatgpt.js + lib/dom.js

window.modals = {
    stack: [], // of types of undismissed modals
    get class() { return `${this.dependencies.app.cssPrefix}-modal` },

    dependencies: {
        import(dependencies) {
            // { app, env, browserLang: env.browser.language (userscript only), isMobile: env.browser.isMobile,
            //   updateCheck (userscript only) }
            for (const name in dependencies) this[name] = dependencies[name]
        }
    },

    env: {
        get runtime() {
            if (typeof GM_info != 'undefined') return 'Greasemonkey userscript'
            else if (typeof chrome != 'undefined' && chrome.runtime) {
                if (typeof browser != 'undefined') return 'Firefox add-on'
                else return `Chromium ${ navigator.userAgent.includes('Edg') ? 'Edge add-on' : 'extension' }`
            } else return 'Unknown'
        }
    },

    getMsg(key) {
        return /Chromium|Firefox/.test(this.env.runtime) ? chrome.i18n.getMessage(key)
            : this.dependencies.app.msgs[key] // assigned from modals.dependencies.import({ app }) in userscript
    },

    alert(title = '', msg = '', btns = '', checkbox = '', width = '') { // generic one from chatgpt.alert()
        const alertID = chatgpt.alert(title, msg, btns, checkbox, width),
              alert = document.getElementById(alertID).firstChild
        this.init(alert) // add class/listener/starry bg
        return alert
    },

    open(modalType, modalSubType) {
        const modal = modalSubType ? this[modalType][modalSubType]() : this[modalType]() // show modal
        this.stack.unshift(modalSubType ? `${modalType}_${modalSubType}` : modalType) // add to stack
        this.init(modal) // add class/listener/starry bg
        this.observeRemoval(modal, modalType, modalSubType) // to maintain stack for proper nav
    },

    init(modal) {
        if (!this.styles) this.stylize() // to init/append stylesheet
        modal.classList.add(this.class) ; modal.onmousedown = this.dragHandlers.mousedown // add class/listener
        dom.fillStarryBG(modal)
    },

    stylize() {
        if (!this.styles) {
            this.styles = document.createElement('style') ; this.styles.id = `${this.class}-styles`
            document.head.append(this.styles)
        }
        this.styles.innerText = (
            `.${this.class} { z-index: 13456 ; position: absolute }` // to be click-draggable
          + ( chatgpt.isDarkMode() ? '.chatgpt-modal > div { border: 1px solid white }' : '' )
          + `.${this.class} button {`
              + 'font-size: 0.77rem ; text-transform: uppercase ;' // shrink/uppercase labels
              + 'border-radius: 0 !important ;' // square borders
              + 'transition: transform 0.1s ease-in-out, box-shadow 0.1s ease-in-out ;' // smoothen hover fx
              + 'cursor: pointer !important ;' // add finger cursor
              + 'padding: 5px !important ; min-width: 102px }' // resize
          + `.${this.class} button:hover {` // add zoom, re-scheme
              + 'transform: scale(1.055) ; color: black !important ;'
              + `background-color: #${ chatgpt.isDarkMode() ? '00cfff' : '9cdaff' } !important }`
          + ( !this.dependencies.isMobile ? `.${this.class} .modal-buttons { margin-left: -13px !important }` : '' )
        )
    },

    observeRemoval(modal, modalType, modalSubType) { // to maintain stack for proper nav
        const modalBG = modal.parentNode
        new MutationObserver(([mutation], obs) => {
            mutation.removedNodes.forEach(removedNode => { if (removedNode == modalBG) {
                if (this.stack[0].includes(modalSubType || modalType)) { // new modal not launched so nav back
                    this.stack.shift() // remove this modal type from stack 1st
                    const prevModalType = this.stack[0]
                    if (prevModalType) { // open it
                        this.stack.shift() // remove type from stack since re-added on open
                        this.open(prevModalType)
                    }
                }
                obs.disconnect()
            }})
        }).observe(modalBG.parentNode, { childList: true, subtree: true })
    },

    dragHandlers: {
        mousedown(event) { // find modal, attach listeners, init XY offsets
            if (event.button != 0) return // prevent non-left-click drag
            if (getComputedStyle(event.target).cursor == 'pointer') return // prevent drag on interactive elems
            modals.dragHandlers.draggableElem = event.currentTarget
            modals.dragHandlers.draggableElem.style.cursor = 'grabbing'
            event.preventDefault(); // prevent sub-elems like icons being draggable
            ['mousemove', 'mouseup'].forEach(event => document.addEventListener(event, modals.dragHandlers[event]))
            const draggableElemRect = modals.dragHandlers.draggableElem.getBoundingClientRect()
            modals.dragHandlers.offsetX = event.clientX - draggableElemRect.left +21
            modals.dragHandlers.offsetY = event.clientY - draggableElemRect.top +12
        },

        mousemove(event) { // drag modal
            if (modals.dragHandlers.draggableElem) {
                const newX = event.clientX - modals.dragHandlers.offsetX,
                      newY = event.clientY - modals.dragHandlers.offsetY
                Object.assign(modals.dragHandlers.draggableElem.style, { left: `${newX}px`, top: `${newY}px` })
            }
        },

        mouseup() { // remove listeners, reset modals.dragHandlers.draggableElem
            modals.dragHandlers.draggableElem.style.cursor = 'inherit';
            ['mousemove', 'mouseup'].forEach(event =>
                document.removeEventListener(event, modals.dragHandlers[event]))
            modals.dragHandlers.draggableElem = null
        }
    },

    about() {

        // Init styles
        const headingStyle = 'font-size: 1.15rem',
              pStyle = 'position: relative ; left: 3px',
              pBrStyle = 'position: relative ; left: 4px ',
              aStyle = 'color: ' + ( chatgpt.isDarkMode() ? '#c67afb' : '#8325c4' ) // purple

        // Init buttons
        const modalBtns = [
            function getSupport(){},
            function rateUs() {},
            function moreAIextensions(){}
        ]
        if (this.env.runtime.includes('Greasemonkey')) modalBtns.unshift(
            function checkForUpdates(){ modals.dependencies.updateCheck() })

        // Show modal
        const aboutModal = modals.alert(
            `${this.dependencies.app.symbol} ${this.getMsg('appName')}`, // title
            `<span style="${headingStyle}"><b>🏷️ <i>${this.getMsg('about_version')}</i></b>: </span>`
                + `<span style="${pStyle}">${this.dependencies.app.version}</span>\n`
            + `<span style="${headingStyle}"><b>⚡ <i>${this.getMsg('about_poweredBy')}</i></b>: </span>`
                + `<span style="${pStyle}">`
                    + `<a style="${aStyle}" href="${this.dependencies.app.urls.chatgptJS}" target="_blank"`
                        + ` rel="noopener">chatgpt.js</a> v${this.dependencies.app.chatgptJSver}</span>\n`
            + `<span style="${headingStyle}"><b>📜 <i>${this.getMsg('about_sourceCode')}</i></b>:</span>\n`
                + `<span style="${pBrStyle}"><a href="${this.dependencies.app.urls.gitHub}" target="_blank"`
                    + ` rel="noopener">${this.dependencies.app.urls.gitHub}</a></span>`,
            modalBtns, '',
            /Chromium|Firefox/.test(this.env.runtime) ? 529 : 546 // set width
        )

        // Format text
        aboutModal.querySelector('h2').style.cssText = 'text-align: center ; font-size: 37px ; padding: 9px'
        aboutModal.querySelector('p').style.cssText = 'text-align: center'

        // Hack buttons
        aboutModal.querySelector('.modal-buttons').style.justifyContent = 'center'
        aboutModal.querySelectorAll('button').forEach(btn => {
            btn.style.cssText = 'cursor: pointer !important ;'
                + `height: ${ this.env.runtime.includes('Greasemonkey') ? 50 : 43 }px`

            // Replace link buttons w/ clones that don't dismiss modal
            if (/support|rate|extensions/i.test(btn.textContent)) {
                const btnClone = btn.cloneNode(true)
                btn.parentNode.replaceChild(btnClone, btn) ; btn = btnClone
                btn.onclick = () => this.safeWinOpen(
                        btn.textContent.includes(this.getMsg('btnLabel_getSupport')) ? this.dependencies.app.urls.support
                      : btn.textContent.includes(this.getMsg('btnLabel_rateUs')) ? this.dependencies.app.urls.review[
                            this.env.runtime.includes('Edge') ? 'edgeAddons'
                          : this.env.runtime.includes('Firefox') ? 'firefoxAddons'
                          : this.env.runtime.includes('Chromium') ? 'chromeWebStore' : 'greasyFork']
                      : this.dependencies.app.urls.relatedExtensions
                    )
            }

            // Prepend emoji + localize labels
            if (/updates/i.test(btn.textContent))
                btn.textContent = `🚀 ${this.getMsg('btnLabel_checkForUpdates')}`
            else if (/support/i.test(btn.textContent))
                btn.textContent = `🧠 ${this.getMsg('btnLabel_getSupport')}`
            else if (/rate/i.test(btn.textContent))
                btn.textContent = `⭐ ${this.getMsg('btnLabel_rateUs')}`
            else if (/extensions/i.test(btn.textContent))
                btn.textContent = `🤖 ${this.getMsg('btnLabel_moreAIextensions')}`

            // Hide Dismiss button
            else btn.style.display = 'none'
        })

        return aboutModal
    },

    donate() {

        // Show modal
        const donateModal = modals.alert(
            `💖 ${this.getMsg('alert_showYourSupport')}`, // title
                `<p>${this.getMsg('appName')} ${this.getMsg('alert_isOSS')}.</p>`
              + `<p>${this.getMsg('alert_despiteAffliction')} `
                  + '<a target="_blank" rel="noopener" href="https://en.wikipedia.org/wiki/Long_COVID">'
                      + `${this.getMsg('alert_longCOVID')}</a> `
                  + `${this.getMsg('alert_since2020')}, ${this.getMsg('alert_byDonatingResults')}.</p>`
              + `<p>${this.getMsg('alert_yourContrib')}, <b>${this.getMsg('alert_noMatterSize')}</b>, `
                  + `${this.getMsg('alert_directlySupports')}.</p>`
              + `<p>${this.getMsg('alert_tyForSupport')}!</p>`
              + '<img src="https://cdn.jsdelivr.net/gh/adamlui/adamlui/images/siggie/'
                  + `${ chatgpt.isDarkMode() ? 'white' : 'black' }.png" `
                  + 'style="height: 54px ; margin: 5px 0 -2px 5px"></img>'
              + `<p>—<b><a target="_blank" rel="noopener" href="${this.dependencies.app.author.url}">`
                  + `${this.getMsg('appAuthor')}</a></b>, ${this.getMsg('alert_author')}</p>`,
            [ // buttons
                function paypal(){},
                function githubSponsors(){},
                function cashApp(){},
                function rateUs() { modals.open('feedback') }
            ], '', 478 // set width
        )

        // Format text
        donateModal.querySelectorAll('p').forEach(p => // v-pad text, shrink line height
            p.style.cssText = 'padding: 8px 0 ; line-height: 20px')

        // Hack buttons
        const btns = donateModal.querySelectorAll('button')
        btns.forEach((btn, idx) => {

            // Replace link buttons w/ clones that don't dismiss modal
            if (!/dismiss|rate/i.test(btn.textContent)) {
                const btnClone = btn.cloneNode(true)
                btn.parentNode.replaceChild(btnClone, btn) ; btn = btnClone
                btn.onclick = () => this.safeWinOpen(this.dependencies.app.urls.donate[
                    btn.textContent == 'Cash App' ? 'cashApp'
                  : btn.textContent == 'Github Sponsors' ? 'gitHub'
                  : 'payPal'
                ])
            }

            // Format buttons
            if (idx == 0) btn.style.display = 'none' // hide Dismiss button
            else {
                btn.style.cssText = 'padding: 8px 6px !important ; margin-top: -14px ;'
                                  + ' width: 107px ; line-height: 14px'
                if (idx == btns.length -1) // de-emphasize right-most button
                    btn.classList.remove('primary-modal-btn')
                else if (/rate/i.test(btn.textContent)) // localize 'Rate Us' label
                    btn.textContent = this.getMsg('btnLabel_rateUs')
            }
        })

        return donateModal
    },

    update: {
        width: 377,

        available() {

            // Show modal
            const updateAvailModal = modals.alert(`🚀 ${modals.getMsg('alert_updateAvail')}!`, // title
                `${modals.getMsg('alert_newerVer')} ${modals.getMsg('appName')} `
                    + `(v${modals.dependencies.app.latestVer}) ${modals.getMsg('alert_isAvail')}!  `
                    + '<a target="_blank" rel="noopener" style="font-size: 0.7rem" href="'
                        + modals.dependencies.app.urls.update.replace(/.+\/([^/]+)meta\.js/,
                            `${modals.dependencies.app.urls.gitHub}/blob/main/greasemonkey/$1user.js`)
                    + `">${modals.getMsg('link_viewChanges')}</a>`,
                function update() { // button
                    modals.safeWinOpen(
                        modals.dependencies.app.urls.update.replace('meta.js', 'user.js') + '?t=' + Date.now())
                }, '', modals.update.width
            )

            // Localize button labels if needed
            if (!modals.dependencies.browserLang.startsWith('en')) {
                const updateBtns = updateAvailModal.querySelectorAll('button')
                updateBtns[1].textContent = modals.getMsg('btnLabel_update')
                updateBtns[0].textContent = modals.getMsg('btnLabel_dismiss')
            }

            return updateAvailModal
        },

        unavailable() {
            return modals.alert(`${modals.getMsg('alert_upToDate')}!`, // title
                `${modals.getMsg('appName')} (v${modals.dependencies.app.version}) ${modals.getMsg('alert_isUpToDate')}!`, // msg
                '', '', modals.update.width
            )
        }
    },

    safeWinOpen(url) { open(url, '_blank', 'noopener') } // to prevent backdoor vulnerabilities
};
