import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';

const LoginForm = ({ setUserCallback }) => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submitForm = async (event) => {
    event.preventDefault();
    await fetch(
      'api/user/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: username, password: password })
      }
    )
      .then((res) => res.json())
      .then((data) => setUserCallback(data.user))
      .catch((err) => { console.log(err.message) });
    setUsername("");
    setPassword("");
    navigate('/chat');
  }

  return (
    <>
      <Card className='p-2 m-2'>
        <Row><h2>Log in</h2></Row>
        <Form onSubmit={submitForm} autoComplete='on'>
          <Form.Group>
            <Form.Control
              className='my-2'
              type='text'
              name='username'
              value={username}
              placeholder='Username...'
              onChange={(event) => setUsername(event.target.value)}
            />
            <Form.Control
              className='my-2'
              type='password'
              name='password'
              value={password}
              placeholder='Password...'
              onChange={(event) => setPassword(event.target.value)}
            />
          </Form.Group>
          <Button type='submit' className='my-2'>Log in</Button>
        </Form>
      </Card>
    </>
  );
}

export default LoginForm;