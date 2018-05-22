// return if something is defined
const def     = x => typeof x !== 'undefined'

// return if something is not defined
const undef   = x => !def(x)

// return the head of the array
const head    = ([x]) => x

// return the tail of the array
const tail    = ([x, ...xs]) => xs

// call a function on every element
const each    = ([x, ...xs], fn, i = 0) => { 
	if (def(x)) {
		fn(x, i) 
		each(xs, fn, i+1)
	}
}

// return a new array with the results of calling a provided function on every element
const map     = ([x, ...xs], fn) => def(x) ? [fn(x), ...map(xs, fn)] : []

// return a new array with all elements that pass the test implemented by the provided function
const filter  = ([x, ...xs], fn) => def(x) 
	? fn(x)
		? [x, ...filter(xs, fn)]
		: [...filter(xs, fn)]
	: []

// return a new array with all elements that fails the test implemented by the provided function
const reject  = ([x, ...xs], fn) => def(x)  
	? fn(x)
		? [...filter(xs, fn)]
		: [x, ...filter(xs, fn)]
	: []

// return if the object is an array
const isArray = xs => Array.isArray(xs)

// return an array of size m and default content
const array  = (m, v = false) => m
	? [v, ...array(m-1, v)]
	: []

// return a matrix of size n x m and default content
const matrix = (n, m, v = false) => n
	? [array(m, v), ...matrix(n-1, m, v)]
	: []

// make a copy of the array
const copy    = xs => [...xs]

// return the concatenation of two arrays
const concat  = ([x, ...xs], ys) => def(x) 
	? [x, ...concat(xs, ys)]
	: def(head(ys))
		? [...concat(ys, [])]
		: []

// find the lenght of the array
const len     = ([x, ...xs]) => def(x) ? 1 + len(xs) : 0

const empty   = (xs) => !xs.length

// reverse the array
const rev     = ([x, ...xs]) => def(x) ? [...rev(xs), x] : []

// create a new array with the first n elements
const first   = ([x, ...xs], n = 1) => def(x) && n ? [x, ...first(xs, n - 1)] : []

// create a new array with the last n elements
const last    = (xs, n = 1) => rev(first(rev(xs), n))

// insert in a array in the index an element
const slice   = ([x, ...xs], i, y, curr = 0) => def(x)
  ? curr === i
    ? [y, x, ...slice(xs, i, y, curr + 1)]
    : [x, ...slice(xs, i, y, curr + 1)]
  : []

// split the array in two, one passing the condition and the rest
const divide  = (xs, fn) => [filter(xs, fn), reject(xs, fn)]

// make an matrix an array
const flatten = ([x, ...xs]) => def(x)
	? isArray(x) 
		? [...flatten(x), ...flatten(xs)] 
		: [x, ...flatten(xs)]
	: []

// Applies a function against an accumulator and each element in the array (from left to right) to reduce it to a single value
const reduce  = ([x, ...xs], fn, acc, i = 0) => def(x)
	? reduce(xs, fn, fn(acc, x, i), i + 1) 
	: acc

// remove duplicated items in array
const unique  = (xs) => def(xs) ? [... new Set(xs)] : []

// Extract property value from array. Useful when combined with the map function
const pluck   = (key, object) => object[key]

// Each function consumes the return value of the function that came before
const flow = (...args) => init => reduce(args, (memo, fn) => fn(memo), init)

// Reverse of flow ex: compose(tax, discount, getPrice) -> (x => tax(discount(getPrice(x))))
const compose = (...args) => flow(...reverse(args))