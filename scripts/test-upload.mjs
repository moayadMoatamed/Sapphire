import { readFileSync } from 'fs'
import path from 'path'

const filePath = 'testing_materials/M-654.pdf'
const fileContent = readFileSync(filePath)
const fileName = path.basename(filePath)

const formData = new FormData()
formData.append('file', new Blob([fileContent], { type: 'application/pdf' }), fileName)

console.log('Uploading', fileName, `(${(fileContent.length / 1024).toFixed(0)} KB)...`)

const res = await fetch('http://localhost:3000/api/books/upload', {
  method: 'POST',
  body: formData,
})

const data = await res.json()
console.log('Status:', res.status)
console.log('Response:', JSON.stringify(data, null, 2))

if (data.bookId) {
  console.log('\nBook ID:', data.bookId)
  console.log('Check progress at:', `http://localhost:3000/books/${data.bookId}`)
}
