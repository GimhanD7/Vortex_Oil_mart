fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({username: 'admin', password: 'password'})
}).then(async res => {
  console.log(res.status);
  console.log(await res.text());
});
