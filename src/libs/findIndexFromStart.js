/**
 * Same as Array.findIndex but requires a start index
 * @param {Array} arr
 * @param {Number} start
 * @param {function} callbackFn
 * @return {number}
 */
const findIndexFromStart = (arr, start, callbackFn) => {
  for (let i = start; i < arr.length; i++) {
    if (callbackFn(arr[i], i, arr)) {
      return i
    }
  }
  return -1
}

module.exports = findIndexFromStart
