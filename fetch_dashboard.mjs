import fs from 'fs'

setTimeout(async () => {
    try {
        const r = await fetch('http://localhost:3001/dashboard')
        const t = await r.text()
        fs.writeFileSync('dev_out.html', t, 'utf8')
        console.log('DONE FETCHING')
    } catch(e) { console.error(e) }
}, 6000)
