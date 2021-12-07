class BaseDCMObj {
  constructor({}) {
  }

  toJSON() {
    return Object.entries(this).reduce((acc, [k, v])=>{
      if (k.startsWith('_')) {
        if (typeof v.toJSON === 'function') acc[k.replace('_', '')] = v.toJSON()
        else if (Array.isArray(v)) {
          acc[k.replace('_', '')] = v.map(ele=>{
            if (typeof ele.toJSON === 'function') return ele.toJSON()
            return ele
          })
        } else {
          acc[k.replace('_', '')] = v
        }
      }
      return acc
    }, {})
  }
}

module.exports = BaseDCMObj