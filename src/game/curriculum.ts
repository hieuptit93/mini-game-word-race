/**
 * Word Racer v2 - Curriculum Data
 * Pre-A1 English vocabulary topics
 */

export interface Topic {
  topic: string;
  q: string;
  pattern: string;
  words: string[];
}

export const CURRICULUM: Topic[] = [
  { topic: 'Weather', q: "What's the weather like?", pattern: 'It is...', words: ['sunny', 'rainy', 'windy', 'cloudy', 'snowy', 'hot'] },
  { topic: 'School Objects', q: "What's this?", pattern: 'This is...', words: ['a pen', 'an eraser', 'a book', 'a pencil', 'a bag', 'a crayon'] },
  { topic: 'Clothes', q: 'What do you have?', pattern: 'I have...', words: ['a hat', 'a skirt', 'a jacket', 'a dress', 'trousers', 'shoes'] },
  { topic: 'Fruits', q: 'What do you like?', pattern: 'I like...', words: ['a banana', 'an apple', 'an orange', 'a mango', 'a lime', 'a coconut'] },
  { topic: 'Home', q: "What's this?", pattern: 'This is...', words: ['a bed', 'a fridge', 'a desk', 'a lamp', 'a window', 'a door'] },
  { topic: 'Sports', q: 'What sports do you like?', pattern: 'I like...', words: ['football', 'basketball', 'badminton', 'swimming', 'cycling', 'running'] },
  { topic: 'Nature', q: 'What do you see?', pattern: 'I see...', words: ['a lake', 'a river', 'a forest', 'a beach', 'a mountain', 'a desert'] },
  { topic: 'Technology', q: "What's it?", pattern: 'It is...', words: ['a radio', 'a camera', 'a speaker', 'a smartphone', 'a laptop', 'a keyboard'] },
  { topic: 'Transportation', q: "What's it?", pattern: "It's...", words: ['a bike', 'a plane', 'a bus', 'a car', 'a boat', 'a truck'] },
  { topic: 'Animals', q: "What's that?", pattern: 'That is...', words: ['a cat', 'a dog', 'a mouse', 'a bear', 'a lion', 'a monkey'] },
  { topic: 'Hobby', q: 'What do you like doing?', pattern: 'I like...', words: ['drawing', 'singing', 'dancing', 'reading', 'cooking', 'shopping'] },
  { topic: 'How I Feel', q: 'How are you?', pattern: 'I am ___.', words: ['happy', 'sad', 'tired', 'hungry', 'fine', 'sick'] },
  { topic: 'Face Parts', q: 'What is this?', pattern: 'This is my ___.', words: ['nose', 'mouth', 'ear', 'eye', 'hair', 'face'] },
  { topic: 'Classroom Colours', q: 'What colour is your pen?', pattern: 'My pen is ___.', words: ['red', 'blue', 'green', 'yellow', 'orange', 'black'] },
  { topic: 'Food I Like', q: 'What food do you like?', pattern: 'I like ___.', words: ['rice', 'noodles', 'soup', 'sausage', 'eggs', 'cake'] },
  { topic: 'Toys I Like', q: 'What toys do you like?', pattern: 'I like ___.', words: ['dolls', 'toy cars', 'kites', 'balls', 'robots', 'balloons'] },
  { topic: 'Rooms', q: 'What room is this?', pattern: 'This is the ___.', words: ['kitchen', 'bathroom', 'bedroom', 'living room', 'dining room', 'garden'] },
  { topic: 'Drinks I Like', q: 'What do you like to drink?', pattern: 'I like ___.', words: ['water', 'milk', 'juice', 'tea', 'juice milk', 'soda'] },
  { topic: 'Vegetables', q: 'What vegetables is this?', pattern: 'This is a ___.', words: ['carrot', 'potato', 'tomato', 'cucumber', 'corn', 'onion'] },
  { topic: 'Size & Shape', q: 'What does it look like?', pattern: 'It is ___.', words: ['big', 'small', 'long', 'short', 'round', 'square'] },
  { topic: 'Games I Like', q: 'What games do you like?', pattern: 'I like ___.', words: ['hide and seek', 'tag', 'racing', 'chess', 'skipping', 'catching'] },
  { topic: 'Sweet Treats', q: 'What are you eating?', pattern: 'I am eating ___.', words: ['candy', 'cake', 'chocolate', 'ice cream', 'cookies', 'popcorn'] },
  { topic: 'Sea Animals', q: 'What is in the water?', pattern: 'It is ___.', words: ['a fish', 'a shark', 'a dolphin', 'a turtle', 'a crab', 'a whale'] },
  { topic: 'Places to Go', q: 'Where do you want to go?', pattern: "Let's go to ___.", words: ['the park', 'the zoo', 'the beach', 'the school', 'the shop', 'the library'] },
];

export function getTopic(round: number): Topic {
  return CURRICULUM[(round - 1) % CURRICULUM.length];
}

export function shuffled<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
