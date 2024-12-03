// NOTE: This script relies on the powerful chatgpt.js library @ https://chatgpt.js.org
//  © 2023–2024 KudoAI & contributors under the MIT license

(async () => {

    document.documentElement.setAttribute('chatgpt-widescreen-extension-installed', true) // for userscript auto-disable

    // Import JS resources
    for (const resource of ['components/modals.js', 'lib/chatgpt.js', 'lib/dom.js', 'lib/settings.js'])
        await import(chrome.runtime.getURL(resource))

    // Init ENV context
    const env = {
        browser: { isMobile: chatgpt.browser.isMobile() }, site: /([^.]+)\.[^.]+$/.exec(location.hostname)[1] }
    settings.import({ env }) // to load/save active tab's settings using env.site

    // Import DATA
    const { app } = await chrome.storage.sync.get('app'),
          { sites } = await chrome.storage.sync.get('sites')
    modals.import({ app, siteAlert })

    // Init SETTINGS
    await settings.load('extensionDisabled', ...sites[env.site].availFeatures)

    // Add CHROME MSG listener for background/popup requests to sync modes/settings
    chrome.runtime.onMessage.addListener(req => {
        if (req.action == 'notify')
            notify(...['msg', 'pos', 'notifDuration', 'shadow'].map(arg => req.options[arg]))
        else if (req.action == 'alert')
            siteAlert(...['title', 'msg', 'btns', 'checkbox', 'width'].map(arg => req.options[arg]))
        else if (req.action == 'showAbout') chatgpt.isLoaded().then(() => { modals.open('about') })
        else if (req.action == 'syncConfigToUI') sync.configToUI()
    })

    // Define FEEDBACK functions

    function notify(msg, pos = '', notifDuration = '', shadow = '') {
        if (config.notifDisabled && !msg.includes(chrome.i18n.getMessage('menuLabel_modeNotifs'))) return

        // Strip state word to append colored one later
        const foundState = [ chrome.i18n.getMessage('state_on').toUpperCase(),
                             chrome.i18n.getMessage('state_off').toUpperCase()
              ].find(word => msg.includes(word))
        if (foundState) msg = msg.replace(foundState, '')

        // Show notification
        chatgpt.notify(`${app.symbol} ${msg}`, pos, notifDuration, shadow || chatgpt.isDarkMode() ? '' : 'shadow')
        const notif = document.querySelector('.chatgpt-notif:last-child')

        // Append styled state word
        if (foundState) {
            const styledStateSpan = dom.create.elem('span')
            styledStateSpan.style.cssText = `color: ${
                foundState == 'OFF' ? '#ef4848 ; text-shadow: rgba(255, 169, 225, 0.44) 2px 1px 5px'
                                    : '#5cef48 ; text-shadow: rgba(255, 250, 169, 0.38) 2px 1px 5px' }`
            styledStateSpan.append(foundState) ; notif.append(styledStateSpan)
        }
    }

    function siteAlert(title = '', msg = '', btns = '', checkbox = '', width = '') {
        const alertID = chatgpt.alert(title, msg, btns, checkbox, width)
        return document.getElementById(alertID).firstChild
    }

    // Define CHATBAR functions

    const chatbar = {

        get() {
            let chatbar = document.querySelector(sites[env.site].selectors.input)
            const parentLvls = env.site == 'chatgpt' ? 3 : 2
            for (let i = 0 ; i < parentLvls ; i++) chatbar = chatbar?.parentNode
            return chatbar
        },

        tweak() {
            const chatbarDiv = chatbar.get() ; if (!chatbarDiv) return
            if (env.site == 'chatgpt') {
                const inputArea = chatbarDiv.querySelector(sites.chatgpt.selectors.input)
                if (inputArea) {
                    if (chatgpt.canvasIsOpen()) inputArea.parentNode.style.width = '100%'
                    else if (!env.tallChatbar) { // narrow it to not clash w/ buttons
                        const widths = { chatbar: chatbarDiv.getBoundingClientRect().width }
                        const visibleBtnTypes = [...btns.types, 'send'].filter(type =>
                            !(type == 'fullWindow' && !sites[env.site].hasSidebar)
                            && !(type == 'newChat' && config.ncbDisabled))
                        visibleBtnTypes.forEach(type =>
                            widths[type] = btns[type]?.getBoundingClientRect().width
                                 || document.querySelector(`${sites.chatgpt.selectors.btns.send}, ${
                                        sites.chatgpt.selectors.btns.stop}`)?.getBoundingClientRect().width || 0 )
                        const totalBtnWidths = visibleBtnTypes.reduce((sum, btnType) => sum + widths[btnType], 0)
                        inputArea.parentNode.style.width = `${ // expand to close gap w/ buttons
                            widths.chatbar - totalBtnWidths -60 }px`
                        inputArea.style.width = '100%' // rid h-scrollbar
                    }
                }
            } else if (env.site == 'poe') {
                const attachFileBtn = chatbarDiv.querySelector(sites.poe.selectors.btns.attachFile),
                      clearBtn = document.querySelector(sites.poe.selectors.btns.clear)
                if (attachFileBtn && !attachFileBtn.style.cssText) { // left-align attach file button
                    attachFileBtn.style.cssText = 'position: absolute ; left: 1rem ; bottom: 0.35rem'
                    document.querySelector(sites.poe.selectors.input) // accommodate new btn pos
                        .style.padding = '0 13px 0 40px'
                }
                btns.newChat.style.top = clearBtn ? '-1px' : 0
                btns.newChat.style.marginRight = clearBtn ? '2px' : '1px'
            }
        },

        reset() { // all tweaks for popup master toggle-off
            const chatbarDiv = chatbar.get() ; if (!chatbarDiv) return
            if (env.site == 'chatgpt') {
                const inputArea = chatbarDiv.querySelector(sites.chatgpt.selectors.input)
                if (inputArea) inputArea.style.width = inputArea.parentNode.style.width = 'initial'
            } else if (env.site == 'poe') {
                const attachFileBtn = chatbarDiv.querySelector(sites.poe.selectors.btns.attachFile)
                if (attachFileBtn) attachFileBtn.style.cssText = ''
            }
        }
    }

    // Define BUTTON props/functions

    const btns = {
        types: [ 'fullScreen', 'fullWindow', 'wideScreen', 'newChat' ], // right-to-left

        svgElems: {
            fullScreen: {
                off: [
                    dom.create.svgElem('path', { stroke: 'none', d: 'm10,16 2,0 0,-4 4,0 0,-2 L 10,10 l 0,6 0,0 z' }),
                    dom.create.svgElem('path', { stroke: 'none', d: 'm20,10 0,2 4,0 0,4 2,0 L 26,10 l -6,0 0,0 z' }),
                    dom.create.svgElem('path', { stroke: 'none', d: 'm24,24 -4,0 0,2 L 26,26 l 0,-6 -2,0 0,4 0,0 z' }),
                    dom.create.svgElem('path',
                        { stroke: 'none', d: 'M 12,20 10,20 10,26 l 6,0 0,-2 -4,0 0,-4 0,0 z' }) ],
                on: [
                    dom.create.svgElem('path', { stroke: 'none', d: 'm14,14-4,0 0,2 6,0 0,-6 -2,0 0,4 0,0 z' }),
                    dom.create.svgElem('path', { stroke: 'none', d: 'm22,14 0,-4 -2,0 0,6 6,0 0,-2 -4,0 0,0 z' }),
                    dom.create.svgElem('path', { stroke: 'none', d: 'm20,26 2,0 0,-4 4,0 0,-2 -6,0 0,6 0,0 z' }),
                    dom.create.svgElem('path', { stroke: 'none', d: 'm10,22 4,0 0,4 2,0 0,-6 -6,0 0,2 0,0 z' }) ]
            },

            fullWin: [
                dom.create.svgElem('rect',
                    { fill: 'none', x: '3', y: '3', width: '17', height: '17', rx: '2', ry: '2' }),
                dom.create.svgElem('line', { x1: '9', y1: '3', x2: '9', y2: '21' })
            ],

            newChat: [ dom.create.svgElem('path', { stroke: 'none', d: 'M22,13h-4v4h-2v-4h-4v-2h4V7h2v4h4V13z' }) ],

            wideScreen: {
                off: [
                    dom.create.svgElem('path', { stroke: 'none', 'fill-rule': 'evenodd',
                        d: 'm28,11 0,14 -20,0 0,-14 z m-18,2 16,0 0,10 -16,0 0,-10 z' }) ],
                on: [
                    dom.create.svgElem('path', { stroke: 'none', 'fill-rule': 'evenodd',
                        d: 'm26,13 0,10 -16,0 0,-10 z m-14,2 12,0 0,6 -12,0 0,-6 z' }) ]
            }
        },

        create() {
            if (env.site == 'chatgpt' && chatbar.get().nextElementSibling && !env.tallChatbar)
                env.tallChatbar = true
            const validBtnTypes = btns.types.filter(type => !(type == 'fullWindow' && !sites[env.site].hasSidebar))
            const bOffset = env.site == 'poe' ? -1.5 : env.site == 'perplexity' ? -13 : env.tallChatbar ? 31 : -8.85,
                  rOffset = env.site == 'poe' ? -6   : env.site == 'perplexity' ? -4  : env.tallChatbar ? 47 : -0.25
            validBtnTypes.forEach(async (btnType, idx) => {
                btns[btnType] = dom.create.elem('div')
                btns[btnType].id = btnType + '-btn' // for toggle.tooltip()
                Object.assign(btns[btnType].style, {
                    position: env.tallChatbar ? 'absolute' : 'relative', cursor: 'pointer',
                    right: `${ rOffset + idx * bOffset }px` // position left of prev button
                })
                if (env.tallChatbar) btns[btnType].style.bottom = '8.85px'
                else btns[btnType].style.top = /chatgpt|openai/.test(env.site) ? '-3.25px' : 0
                if (/chatgpt|perplexity/.test(env.site)) { // assign classes + tweak styles
                    const sendBtn = await new Promise(resolve => {
                        const sendBtn = document.querySelector(sites[env.site].selectors.btns.send)
                        if (sendBtn) resolve(sendBtn)
                        else new MutationObserver((_, obs) => {
                            const sendBtn = document.querySelector(sites[env.site].selectors.btns.send)
                            if (sendBtn) { obs.disconnect() ; resolve(sendBtn) }
                        }).observe(document.body, { childList: true, subtree: true })
                    })
                    btns[btnType].setAttribute('class', sendBtn.classList.toString() || '')
                    Object.assign(btns[btnType].style, { // remove dark mode overlay
                        backgroundColor: 'transparent', borderColor: 'transparent' })
                } else if (env.site == 'poe') // lift buttons slightly
                    btns[btnType].style.marginBottom = ( btnType == 'newChat' ? '0.45' : '0.2' ) + 'rem'

                // Add hover/click listeners
                btns[btnType].onmouseover = btns[btnType].onmouseout = toggle.tooltip
                btns[btnType].onclick = () => {
                    if (btnType == 'newChat') {
                        document.querySelector(sites[env.site].selectors.btns.newChat)?.click()
                        tooltipDiv.style.opacity = 0
                    } else toggle.mode(btnType)
                }
            })
            btns.updateColor()
        },

        insert() {
            if (btns.status?.startsWith('insert') || document.getElementById('wideScreen-btn')) return
            btns.status = 'inserting' ; if (!btns.wideScreen) btns.create()

            // Init elems
            const chatbarDiv = chatbar.get() ; if (!chatbarDiv) return
            const btnTypesToInsert = btns.types.slice().reverse() // to left-to-right for insertion order
                .filter(type => !(type == 'fullWindow' && !sites[env.site].hasSidebar))
            const parentToInsertInto = env.site == 'chatgpt' ? chatbarDiv.nextElementSibling || chatbarDiv
                                     : env.site == 'perplexity' ? chatbarDiv.lastChild // Pro spam toggle parent
                                     : chatbarDiv
            const elemToInsertBefore = env.site == 'chatgpt' ? parentToInsertInto.lastChild
                                     : env.site == 'perplexity' ? parentToInsertInto.firstChild // Pro spam toggle
                                     : chatbarDiv.children[1]
            // Insert buttons
            btnTypesToInsert.forEach(btnType => {
                btns.updateSVG(btnType) // update icon
                parentToInsertInto.insertBefore(btns[btnType], elemToInsertBefore)
            })
            parentToInsertInto.insertBefore(tooltipDiv, elemToInsertBefore) // add tooltips
            setTimeout(() => chatbar.tweak(), 1)
            btns.status = 'inserted'
        },

        remove() {
            if (!chatbar.get() || !document.getElementById('wideScreen-btn')) return
            btns.types.forEach(type => btns[type]?.remove()) ; tooltipDiv?.remove()
            btns.status = 'missing' // ensure next btns.insert() doesn't return early
        },

        updateColor() {
            btns.color = (
                env.site == 'chatgpt' ? (
                    document.querySelector('.dark.bg-black') || chatgpt.isDarkMode() ? 'white' : '#202123' )
              : env.site == 'perplexity' ? (
                    document.documentElement.dataset.colorScheme == 'dark' ?
                        'oklch(var(--dark-text-color-100)/var(--tw-text-opacity))'
                      : 'oklch(var(--text-color-100)/var(--tw-text-opacity))' )
              : 'currentColor' )

            if (btns.wideScreen?.style.fill != btns.color)
                btns.types.forEach(type => {
                    if (btns[type]) btns[type].style.fill = btns[type].style.stroke = btns.color })
        },

        updateSVG(mode, state = '') {
            if (!btns.wideScreen) btns.create()

            // Pick appropriate button/elements
            const [btn, ONelems, OFFelems] = (
                mode == 'fullScreen' ? [btns.fullScreen, btns.svgElems.fullScreen.on, btns.svgElems.fullScreen.off]
              : mode == 'fullWindow' ? [btns.fullWindow, btns.svgElems.fullWin, btns.svgElems.fullWin]
              : mode == 'wideScreen' ? [btns.wideScreen, btns.svgElems.wideScreen.on, btns.svgElems.wideScreen.off]
                                     : [btns.newChat, btns.svgElems.newChat, btns.svgElems.newChat])
            if (!btn) return

            // Set SVG attributes
            const btnSVG = btn?.querySelector('svg') || dom.create.svgElem('svg', { height: 18 })
            btnSVG.setAttribute('height', 18) // prevent shrinking
            if (mode == 'fullWindow') { // stylize full-window button
                btnSVG.setAttribute('stroke-width', '2')
                const btnSize = env.site == 'perplexity' ? 18 : 'poe' ? '2em' : 17
                btnSVG.setAttribute('height', btnSize) ; btnSVG.setAttribute('width', btnSize)
            }
            btnSVG.setAttribute('viewBox', (
                mode == 'newChat' ? '11 6 ' : mode == 'fullWindow' ? '-2 -0.5 ' : '8 8 ' )
            + ( mode == 'newChat' ? '13 13' : mode == 'fullWindow' ? '24 24' : '20 20' )
            )
            btnSVG.style.pointerEvents = 'none' // prevent triggering tooltips twice
            if (env.site == 'chatgpt') // override button resizing
                btnSVG.style.height = btnSVG.style.width = '1.3rem'

            // Update SVG elements
            btnSVG.textContent = ''
            const svgElems = config[mode] || state.toLowerCase() == 'on' ? ONelems : OFFelems
            svgElems.forEach(elem => btnSVG.append(elem))

            // Update SVG
            if (!btn.contains(btnSVG)) btn.append(btnSVG)
        }
    }

    // Define UPDATE functions

    const update = {

        style: {

            chatbar() {
                chatbarStyle.innerText = (
                    env.site == 'chatgpt' ? ( config.widerChatbox ? ''
                        : `main form { max-width: ${chatbar.nativeWidth}px !important ; margin: auto }` )
                  : env.site == 'poe' ? ( !config.widerChatbox ? ''
                        : '[class*=footerInner] { width: 100% }' )
                  : '' )
            },

            tweaks() {
                tweaksStyle.innerText = (
                    '[class$="-modal"] { z-index: 13456 ; position: absolute }' // to be click-draggable
                  + '[class*="-modal"] button {'
                      + 'font-size: 0.77rem ; text-transform: uppercase ;' // shrink/uppercase labels
                      + 'border-radius: 0 !important ;' // square borders
                      + 'transition: transform 0.1s ease-in-out, box-shadow 0.1s ease-in-out ;' // smoothen hover fx
                      + 'cursor: pointer !important ;' // add finger cursor
                      + 'padding: 5px !important ; min-width: 102px }' // resize
                  + '.chatgpt-modal button:hover {' // add zoom, re-scheme
                      + 'transform: scale(1.055) ; color: black !important ;'
                      + `background-color: #${ chatgpt.isDarkMode() ? '00cfff' : '9cdaff' } !important }`
                  + ( !env.browser.isMobile ? '.modal-buttons { margin-left: -13px !important }' : '' )
                  + ( env.site == 'chatgpt' ? (
                          ( '[id$="-btn"]:hover { opacity: 80% !important }' ) // dim chatbar btns on hover
                          + 'main { overflow: clip !important }' // prevent h-scrollbar...
                                // ...on sync.mode('fullWindow) => delayed chatbar.tweak()
                    ) : env.site == 'poe' ? // h-pad mic btn for even spread
                        'button[class*="Voice"] { margin: 0 -3px 0 -8px }' : '' ))
                  + ( config.tcbDisabled == false ? tcbStyle : '' ) // expand text input vertically
                  + ( config.hiddenHeader ? hhStyle : '' ) // hide header
                  + ( config.hiddenFooter ? hfStyle : '' ) // hide footer
                  + `#newChat-btn { display: ${ config.ncbDisabled == true ? 'none' : 'flex' }}`
            },

            wideScreen() {
                wideScreenStyle.innerText = (
                    env.site == 'chatgpt' ? (
                        '.text-base { max-width: 100% !important }' // widen outer container
                      + '.text-base:nth-of-type(2) { max-width: 97% !important }' // widen inner container
                  ) : env.site == 'perplexity' ? (
                        `${sites.perplexity.selectors.header} ~ div,` // outer container
                      + `${sites.perplexity.selectors.header} ~ div > div` // inner container
                          + '{ max-width: 100% }' // ...widen them
                      + '.col-span-8 { width: 154% }' // widen inner-left container
                      + '.col-span-4 { width: 13.5% ; position: absolute ; right: 0 }' // narrow right-bar
                  ) : env.site == 'poe' ? (
                        '[class*="ChatMessagesView"] { width: 100% !important }' // widen outer container
                      + '[class^="Message"] { max-width: 100% !important }' ) // widen speech bubbles
                  : '' )
            }
        },

        tooltip(btnType) { // text & position
            const visibleBtnTypes = btns.types.filter(type => !(type == 'fullWindow' && !sites[env.site].hasSidebar))
            const ctrAddend = ( env.site == 'perplexity' ? ( location.pathname == '/' ? 100 : 106 )
                              : env.site == 'poe' ? 45 : 13 ) +25,
                  spreadFactor = env.site == 'perplexity' ? 26.85 : env.site == 'poe' ? 34 : 30.55,
                  iniRoffset = spreadFactor * ( visibleBtnTypes.indexOf(btnType) +1 ) + ctrAddend
                             + ( env.tallChatbar ? -3 : 4 )
            tooltipDiv.innerText = chrome.i18n.getMessage('tooltip_' + btnType + (
                !/full|wide/i.test(btnType) ? '' : (config[btnType] ? 'OFF' : 'ON')))
            tooltipDiv.style.right = `${ // x-pos
                iniRoffset - tooltipDiv.getBoundingClientRect().width /2 }px`
            tooltipDiv.style.bottom = ( // y-pos
                env.site == 'perplexity' ? ( location.pathname != '/' ? '58px' :
                    ( !document.querySelector(sites.perplexity.selectors.btns.login) ? 'revert-layer' : '52.5vh' ))
                                         : '50px' )
        }
    }

    // Define TOGGLE functions

    const toggle = {

        mode(mode, state = '') {
            switch (state.toUpperCase()) {
                case 'ON' : activateMode(mode) ; break
                case 'OFF' : deactivateMode(mode) ; break
                default : ( mode == 'wideScreen' ? document.head.contains(wideScreenStyle)
                          : mode == 'fullWindow' ? isFullWin() : chatgpt.isFullScreen() ) ? deactivateMode(mode)
                                                                                          : activateMode(mode)
            }

            function activateMode(mode) {
                if (mode == 'wideScreen') { document.head.append(wideScreenStyle) ; sync.mode('wideScreen') }
                else if (mode == 'fullWindow') {
                    const sidebarToggle = document.querySelector(sites[env.site].selectors.btns.sidebarToggle)
                    if (sidebarToggle) sidebarToggle.click()
                    else { document.head.append(fullWinStyle) ; sync.mode('fullWindow') }
                } else if (mode == 'fullScreen') document.documentElement.requestFullscreen()
            }

            function deactivateMode(mode) {
                if (mode == 'wideScreen') {
                    wideScreenStyle.remove() ; sync.mode('wideScreen')
                } else if (mode == 'fullWindow') {
                    const sidebarToggle = document.querySelector(sites[env.site].selectors.btns.sidebarToggle)
                    if (sidebarToggle) sidebarToggle.click()
                    else { fullWinStyle.remove() ; sync.mode('fullWindow') }
                } else if (mode == 'fullScreen') {
                    if (config.f11) siteAlert(
                        chrome.i18n.getMessage('alert_pressF11'), `${chrome.i18n.getMessage('alert_f11reason')}.`)
                    else document.exitFullscreen().catch(
                        err => console.error(app.symbol + ' » Failed to exit fullscreen', err))
                }
            }
        },

        tooltip(event) {
            update.tooltip(event.currentTarget.id.replace(/-btn$/, ''))
            tooltipDiv.style.opacity = event.type == 'mouseover' ? 1 : 0
        }
    }

    // Define SYNC functions

    const sync = {

        async configToUI() { // on toolbar popup toggles + AI tab activations
            const extensionWasDisabled = config.extensionDisabled
            await settings.load('extensionDisabled', ...sites[env.site].availFeatures)
            if (!extensionWasDisabled && config.extensionDisabled) { // outright disable modes/tweaks/btns
                wideScreenStyle.remove() ; fullWinStyle.remove()
                tweaksStyle.innerText = '' ; btns.remove() ; chatbar.reset()
            } else if (!config.extensionDisabled) { // sync modes/tweaks/btns
                if (config.wideScreen ^ document.head.contains(wideScreenStyle)) {
                    supressNotifs() ; toggle.mode('wideScreen') }
                if ((config.fullWindow && sites[env.site].hasSidebar) ^ isFullWin()) {
                    supressNotifs() ; toggle.mode('fullWindow') }
                sync.fullerWin() // sync Fuller Windows
                update.style.tweaks() // sync TCB/NCB/HH/HF
                update.style.chatbar() // sync WCB
                chatbar.tweak() // update chatgpt.com chatbar inner width + apply poe.com btn alignment (once)
                btns.insert()
            }

            function supressNotifs() {
                if (!config.notifDisabled) {
                    settings.save('notifDisabled', true) // suppress notifs for cleaner UI
                    setTimeout(() => settings.save('notifDisabled', false), 55) // ...temporarily
                }
            }
        },

        fullerWin() {
            if (config.fullWindow && config.fullerWindows && !config.wideScreen) { // activate fuller windows
                document.head.append(wideScreenStyle) ; btns.updateSVG('wideScreen', 'on')
            } else if (!config.fullWindow) { // de-activate fuller windows
                fullWinStyle.remove() // to remove style too so sidebar shows
                if (!config.wideScreen) { // disable widescreen if result of fuller window
                    wideScreenStyle.remove() ; btns.updateSVG('wideScreen', 'off')
            }}
        },

        async mode(mode) { // setting + icon + tooltip + chatbar
            const state = ( mode == 'wideScreen' ? !!document.getElementById('wideScreen-mode')
                          : mode == 'fullWindow' ? isFullWin()
                                                 : chatgpt.isFullScreen() )
            settings.save(mode, state) ; btns.updateSVG(mode) ; update.tooltip(mode)
            if (!config.extensionDisabled) { // tweak UI
                if (mode == 'fullWindow') sync.fullerWin()
                if (env.site == 'chatgpt') setTimeout(() => chatbar.tweak(), // update inner width
                    mode == 'fullWindow' && ( config.wideScreen || config.fullerWindows )
                        && config.widerChatbox ? 111 : 0) // delay if toggled to/from active WCB to avoid wrong width
                notify(`${chrome.i18n.getMessage('mode_' + mode)} ${
                          chrome.i18n.getMessage(`state_${ state ? 'on' : 'off' }`).toUpperCase()}`)
            }
            config.modeSynced = true ; setTimeout(() => config.modeSynced = false, 100) // prevent repetition
        }
    }

    // Define UI functions

    function isFullWin() {
        return env.site == 'poe' ? !!document.getElementById('fullWindow-mode')
            : !sites[env.site].hasSidebar // false if sidebar non-existent
           || /\d+/.exec(getComputedStyle(document.querySelector(
                  sites[env.site].selectors.sidebar))?.width || '')[0] < 100
    }

    chatgpt.canvasIsOpen = function() {
        return document.querySelector('section.popover')?.getBoundingClientRect().top == 0 }

    // Run MAIN routine

    // Init UI props
    if (env.site == 'chatgpt') {
        sites.chatgpt.hasSidebar = await Promise.race([
            dom.elemIsLoaded(sites.chatgpt.selectors.btns.sidebarToggle), // true if sidebar toggle loads
            dom.elemIsLoaded(sites.chatgpt.selectors.btns.login).then(() => false), // false if login button loads
            new Promise(resolve => setTimeout(() => resolve(null), 3000)) // null if 3s passed
        ])
        sites.chatgpt.selectors.footer = await Promise.race([
            new Promise(resolve => { // class of footer container
                const footerDiv = chatgpt.getFooterDiv()
                if (footerDiv) resolve(dom.cssSelectorize(footerDiv.classList))
                else new MutationObserver((_, obs) => {
                    const footerDiv = chatgpt.getFooterDiv()
                    if (footerDiv) { obs.disconnect() ; resolve(dom.cssSelectorize(footerDiv.classList)) }
                }).observe(document.body, { childList: true, subtree: true })
            }),
            new Promise(resolve => setTimeout(() => resolve(null), 500)) // null if 500ms passed
        ])
    }

    // Init FULL-MODE states
    config.fullScreen = chatgpt.isFullScreen()
    if (sites[env.site].selectors.btns.sidebarToggle) // site has native FW state
         config.fullWindow = isFullWin() // ...so match it
    else await settings.load('fullWindow') // otherwise load CWM's saved state

    // Create/stylize TOOLTIP div
    const tooltipDiv = dom.create.elem('div', { class: 'cwm-tooltip' })
    document.head.append(dom.create.style('.cwm-tooltip {'
        + 'background-color: rgba(0, 0, 0, 0.71) ; padding: 5px ; border-radius: 6px ; border: 1px solid #d9d9e3 ;'
        + 'font-size: 0.85rem ; color: white ;' // font style
        + 'box-shadow: 4px 6px 16px 0 rgb(0 0 0 / 38%) ;' // drop shadow
        + 'position: absolute ; bottom: 58px ; opacity: 0 ; transition: opacity 0.1s ; z-index: 9999 ;' // visibility
        + '-webkit-user-select: none ; -moz-user-select: none ; -ms-user-select: none ; user-select: none }'
    ))

    // Create/apply general style TWEAKS
    const tweaksStyle = dom.create.style()
    const tcbStyle = ( // heighten chatbox
              env.site == 'chatgpt' ? `div[class*="prose"]:has(${sites.chatgpt.selectors.input})`
                                    : sites[env.site].selectors.input )
                   + '{ max-height: 68vh }'
    const hhStyle = sites[env.site].selectors.header + '{ display: none !important }' // hide header
                  + ( env.site == 'chatgpt' ? 'main { padding-top: 12px }' : '' ) // increase top-padding
    const hfStyle = sites[env.site].selectors.footer + '{ visibility: hidden ;' // hide footer text
                                                     + '  height: 3px ; overflow: clip }' // reduce height

    update.style.tweaks() ; document.head.append(tweaksStyle);

    // Add STARS styles
    ['black', 'white'].forEach(color => document.head.append(
        dom.create.elem('link', { rel: 'stylesheet',
            href: `https://cdn.jsdelivr.net/gh/adamlui/chatgpt-infinity@d751c80/assets/styles/css/${color}-rising-stars.min.css`
    })))

    // Create WIDESCREEN style
    const wideScreenStyle = dom.create.style()
    wideScreenStyle.id = 'wideScreen-mode' // for sync.mode()
    if (!chatbar.get()) await dom.elemIsLoaded(sites[env.site].selectors.input)
    if (env.site == 'chatgpt') // store native chatbar width for Wider Chatbox style
        chatbar.nativeWidth = /\d+/.exec(getComputedStyle(document.querySelector('main form')).width)[0]
    update.style.wideScreen()

    // Create FULL-WINDOW style
    const fullWinStyle = dom.create.style()
    fullWinStyle.id = 'fullWindow-mode' // for sync.mode()
    fullWinStyle.innerText = sites[env.site].selectors.sidebar + '{ display: none }'

    // Create/append CHATBAR style
    const chatbarStyle = dom.create.style()
    update.style.chatbar() ; document.head.append(chatbarStyle)

    // Insert BUTTONS
    if (!config.extensionDisabled) {
        btns.insert()

    // Restore PREV SESSION's state
        if (config.wideScreen) toggle.mode('wideScreen', 'ON')
        if (config.fullWindow && sites[env.site].hasSidebar) {
            if (sites[env.site].selectors.btns.sidebarToggle) // site has own FW config
                sync.mode('fullWindow') // ...so sync w/ it
            else toggle.mode('fullWindow', 'on') // otherwise self-toggle
        }
    }

    // Monitor NODE CHANGES to maintain button visibility + update colors
    let isTempChat = false, canvasWasOpen = chatgpt.canvasIsOpen()
    const nodeObserver = new MutationObserver(([mutation]) => {
        if (config.extensionDisabled) return
        if (env.site == 'chatgpt') {
            if (!canvasWasOpen && chatgpt.canvasIsOpen()) {
                btns.remove() ; chatbar.tweak() ; canvasWasOpen = true
            } else if (canvasWasOpen && !chatgpt.canvasIsOpen()) {
                btns.insert() ; chatbar.tweak() ; canvasWasOpen = false }
        }
        if (!document.getElementById('wideScreen-btn') && btns.status != 'inserting') {
            btns.status = 'missing' ; btns.insert() }
        if (env.site == 'chatgpt') { // Update button colors on ChatGPT scheme or temp chat toggle
            const chatbarIsBlack = !!document.querySelector('div[class*="bg-black"]:not([id$="-btn"])')
            if (chatbarIsBlack != isTempChat // temp chat toggled
                || mutation.target == document.documentElement && mutation.attributeName == 'class') { // scheme toggled
                    btns.updateColor() ; isTempChat = chatbarIsBlack }
        }
    })
    nodeObserver.observe(document[env.site == 'poe' ? 'head' : 'body'], { attributes: true, subtree: true })

    // Monitor SIDEBAR to update full-window setting for sites w/ native toggle
    if (sites[env.site].selectors.btns.sidebarToggle && sites[env.site].hasSidebar) {
        const sidebarObserver = new MutationObserver(async () => {
            await new Promise(resolve => setTimeout(resolve, env.site == 'perplexity' ? 500 : 0))
            if ((config.fullWindow ^ isFullWin()) && !config.modeSynced) sync.mode('fullWindow')
        })
        setTimeout(() => { // delay half-sec before observing to avoid repeated toggles from nodeObserver
            let obsTarget = document.querySelector(sites[env.site].selectors.sidebar)
            if (env.site == 'perplexity') obsTarget = obsTarget.parentNode
            sidebarObserver.observe(obsTarget, { attributes: true })
        }, 500)
    }

    // Add RESIZE LISTENER to update full screen setting/button + disable F11 flag
    window.addEventListener('resize', () => {
        const fullScreenState = chatgpt.isFullScreen()
        if (config.fullScreen && !fullScreenState) { // exiting full screen
            sync.mode('fullScreen') ; config.f11 = false }
        else if (!config.fullScreen && fullScreenState) // entering full screen
            sync.mode('fullScreen')
        if (env.site == 'chatgpt') chatbar.tweak() // update chatgpt.com chatbar inner width
    })

    // Add KEY LISTENER to enable flag on F11 + stop generating text on ESC
    document.addEventListener('keydown', event => {
        if ((event.key == 'F11' || event.keyCode == 122) && !config.fullScreen) config.f11 = true
        else if ((event.key == 'Escape' || event.keyCode == 27) && !chatgpt.isIdle()) chatgpt.stop()
    })

})()
