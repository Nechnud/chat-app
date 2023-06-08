import React, { useState } from 'react';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';

const ChatCreate = ({ setSelectedChatCallback, setNewChatCallback, setChatsCallback }) => {
  const [chatSubject, setChatSubject] = useState("");

  const submitNewChatForm = async (event) => {
    event.preventDefault();
    if (chatSubject.length > 200) {
      alert('Chat subject too long (Max 200 characters).');
      return;
    }
    await fetch(
      'api/chat/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ subject: chatSubject })
      }
    )
      .then((res) => res.json())
      .then((data) => {
        let chatObject = data.chat;
        chatObject.chat_id = chatObject.id;
        setSelectedChatCallback(chatObject);
        setNewChatCallback(false);
      })
      .catch((err) => { console.log(err.message); })
    setChatSubject("");
    await fetch(
      `api/chats`,
      {
        method: 'GET'
      }
    )
      .then((res) => res.json())
      .then((data) => setChatsCallback(data.result))
      .catch((err) => console.log(err.message));
  }

  return (
    <>
      <Card className='p-2 m-2'>
        <Row><h3>Create new chat</h3></Row>
        <Form onSubmit={submitNewChatForm}>
          <Form.Group>
            <Form.Control
              className='my-2'
              type='text'
              value={chatSubject}
              placeholder={'Enter chat subject...'}
              onChange={(event) => setChatSubject(event.target.value)}
            />
          </Form.Group>
          <Button disabled={chatSubject.length > 200} type='submit' className='my-2'>Create chat</Button>
        </Form>
      </Card>
    </>
  )
}

export default ChatCreate;