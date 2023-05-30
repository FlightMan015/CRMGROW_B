const phone = document.querySelector('.cell_phone span').innerText;
let newStr = phone.replace(/\D/g, '');
if (newStr.length < 10) {
  while (newStr.length < 10) {
    newStr = '0' + newStr;
  }
}
newStr = newStr.slice(newStr.length - 10, newStr.length);
let result = '';
result =
  '(' +
  newStr.slice(0, 3) +
  ') ' +
  newStr.slice(3, 6) +
  '-' +
  newStr.slice(6, 10);
document.querySelector('.cell_phone span').innerText = result;
