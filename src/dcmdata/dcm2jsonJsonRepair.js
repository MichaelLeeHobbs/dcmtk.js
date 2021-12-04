const dicomArrayRepair = (val, debug) => {
    let newArr = []
    let invalid = false
    let isNumber = /^[+-]?[0-9]*\.?[0-9]+$/
    let arr = val.split(',').map(ele => ele.trim())
    if (debug) arr.forEach(ele => console.log(`isNumber? ${ele} ${isNumber.test(ele)}`))
    arr.forEach(ele => {
        if (!isNumber.test(ele) || ele.indexOf('+') > -1) invalid = true
        if (ele.indexOf('.') === 0) invalid = true
        newArr.push(isNumber.test(ele) ? Number.parseFloat(ele) : `${'' + ele}`)
    })
    if (debug) console.log('invalid: ', invalid)
    if (debug) console.log('newArr: ', newArr, JSON.stringify(newArr))
    if (invalid) return JSON.stringify(newArr)
}

const jsonRepair = ({json, debug}) => {
    let repaired = json
    let matchTag = /("\d{8}":{"vr":"[DI]S","Value":\[(.*?)\]})/g
    let isQuoted = (val) => val.slice(0, 1) === '"' && val.slice(-1) === '"'
    let matches
    let message = 'Repaired bad JSON in: '
    while ((matches = matchTag.exec(json)) !== null) {
        if (debug) delete matches.input
        if (debug) console.log('matches ', matches)
        if (!isQuoted(matches[2])) {
            if (debug) console.log(`-->${matches[2]}<-- is not quoted`)
            let dicomArray = dicomArrayRepair(matches[2], debug)
            if (dicomArray) {
                message += `${matches[1]} values: ${matches[2]}\n`
                let replacement = matches[1].replace(`"Value":[${matches[2]}]`, `"Value":${dicomArray}`)
                repaired = repaired.replace(matches[1], replacement)
                if (debug) message += `Replaced: ${matches[1]} with: ${replacement}\n`
            }
        }
    }

    // Missing Coma repair
    repaired = repaired.replace(/}"/g, '},"')

    if (debug) console.log(message)
    message = (message === 'Repaired bad JSON in: ') ? undefined : message.trim()
    return {json: repaired, message}
}
module.exports = jsonRepair
