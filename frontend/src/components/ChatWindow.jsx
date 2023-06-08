import React, { useState, useEffect } from 'react';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Badge from 'react-bootstrap/Badge';

let sse;

const ChatWindow = ({ chatData, userData, setSelectedChatCallback }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [enableChatInviting, setEnableChatInviting] = useState(false);
  const [enableChatModerating, setEnableChatModerating] = useState(false);
  const [userList, setUserList] = useState([]);
  const [searchedUsername, setSearchedUsername] = useState('');

  const startSSE = () => {
    sse && sse.close();
    sse = new EventSource(`/api/sse?chatId=${chatData.chat_id}`);

    sse.addEventListener('connect', message => {
      let data = JSON.parse(message.data);
      data.chatData = chatData;
    });

    sse.addEventListener('disconnect', message => {
      let data = JSON.parse(message.data);
      sse.close();
    });

    sse.addEventListener('new-message', message => {
      let data = JSON.parse(message.data);
      data.chatData = chatData;
      setMessages(messages => [...messages, data]);
    });
  }

  const getChatMessages = async (chatId) => {
    await fetch(
      `/api/chat/messages/${chatId}`,
      {
        method: 'GET'
      }
    )
      .then((res) => res.json())
      .then((data) => setMessages(data.result))
      .catch((err) => console.log(err.message));
  }

  useEffect(() => {
    startSSE()
    getChatMessages(chatData.chat_id);
  }, []);

  useEffect(() => {
    const getUserList = async () => {
      await fetch(
        // ta bort hårdkodat varde på limit?
        `/api/user/search?limit=15&searchValue=${searchedUsername}`,
        {
          method: 'GET'
        }
      )
        .then((res) => res.json())
        .then((data) => setUserList(data.result))
        .catch((err) => console.log(err.message));
    }

    getUserList();
  }, [searchedUsername]);

  useEffect(() => {
    let scroll_to_bottom = document.querySelector(".chatWrapper")
    scroll_to_bottom.scrollTop = scroll_to_bottom.scrollHeight
  }, [messages]);

  const submitMessageForm = async (event) => {
    event.preventDefault();
    await fetch(
      'api/chat/message',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chatId: chatData.chat_id,
          content: userData.userRole === 'superadmin' ? message + ' /ADMIN' : message,
          from: userData.username,
          fromId: userData.id
        })
      }
    )
      .then(setMessage(""))
      .catch((err) => {
        console.log(err.message);
      });
  }

  const submitChatInvite = async (event) => {
    event.preventDefault();
  }

  return (
    <>
      <Card className='p-2 m-2'>
        <Row className='my-2 text-center'>
          <Col>
            <h2>{chatData.chat_subject}</h2>
          </Col>
          <Col>
            <Button
              onClick={async () => {
                //sse.close();
                /* await fetch(
                  'api/chat/disconnect',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ chatId: chatData.chat_id })
                  }
                )
                  .catch((err) => {
                    console.log(err.messages);
                  }); */
                setSelectedChatCallback(false);
              }}
            >
              🚫 Close
            </Button>
          </Col>
        </Row>
        <Row>
          {
            userData && chatData && userData.id === chatData.created_by &&
            <Col>
              <Button onClick={async () => {
                setEnableChatInviting(true);
                await fetch(
                  `api/chat/invite?chatId=${chatData.chat_id}`,
                  {
                    method: 'GET'
                  }
                )
                  .then((res) => res.json())
                  .then((data) => setUserList(data.result))
                  .catch((err) => console.log(err.message));
              }}
              >
                Invite users
              </Button>
            </Col>
          }
          {
            (
              (userData && chatData && userData.id === chatData.created_by) ||
              (userData.userRole === 'superadmin')
            ) &&
            <Col>
              <Button onClick={async () => {
                setEnableChatModerating(true);
                await fetch(
                  `api/chat/users?chatId=${chatData.chat_id}`,
                  {
                    method: 'GET'
                  }
                )
                  .then((res) => res.json())
                  .then((data) => setUserList(data.result))
                  .catch((err) => console.log(err.message))
              }}
              >
                🛡️ Moderate chat
              </Button>
            </Col>
          }
        </Row>
        <div className='my-2'>Messages</div>
        <div className='chatWrapper text-left'>
          {
            messages.length > 0 && messages.map((message, id) => (
              <Col key={id}>
                <Card className={message.fromId === userData.id ? 'messageMine my-1 px-1' : 'messageOther my-1 px-1'}>
                  <Row>
                    <Col>{message.from} @ ⏲ {new Date(message.timestamp).toISOString().slice(0, 16).split("T").join(" ")}</Col>
                    {
                      userData.userRole === 'superadmin' &&
                      <Col>
                        <Badge bg='danger' className='deleteMessageBadge'
                          onClick={async () => {
                            await fetch(
                              `/api/chat/delete-message/${message.id}`,
                              {
                                method: 'DELETE'
                              }
                            )
                              .then((res) => res.json())
                              .then(() => getChatMessages(chatData.chat_id))
                              .catch((err) => console.log(err.message));
                          }}>
                          Delete
                        </Badge>
                      </Col>
                    }
                  </Row>
                  <hr style={{ margin: 0, padding: 0 }}></hr>
                  <Row>
                    <Col className='mt-3'>{message.content}</Col>
                  </Row>
                </Card>
              </Col>
            ))
          }
        </div>
        <Form onSubmit={submitMessageForm} autoComplete='on'>
          <Form.Group>
            <Form.Control
              className='my-2'
              type='text'
              value={message}
              placeholder={'Type...'}
              onChange={(event) => setMessage(event.target.value)}
            />
          </Form.Group>
          <Button type='submit' disabled={message.length > 999}>Send 📨</Button>
        </Form>
      </Card >
      {
        <Modal show={enableChatInviting} backdrop='static' centered>
          <Modal.Header className='text-center'><h2>Invite users</h2></Modal.Header>
          <Modal.Body>
            <Form onSubmit={submitChatInvite}>
              <Form.Group>
                <Form.Control
                  autoComplete='off'
                  className='my-2'
                  type='text'
                  value={searchedUsername}
                  placeholder='Search...'
                  onChange={(event) => setSearchedUsername(event.target.value)}
                />
              </Form.Group>
            </Form>
            <div className='userListWrapper'>
              {
                userList.length > 0 && userList.map((user, id) => (
                  <Row className='text-center align-items-center m-2' key={id}>
                    <Col>{user.username}</Col>
                    <Col>
                      <Button onClick={async (e) => {
                        await fetch(
                          `api/chat/invite?chatId=${chatData.chat_id}&userId=${user.id}`,
                          {
                            method: 'POST',
                            header: {
                              'Content-Type': 'application/json'
                            }
                          }
                        )
                          .then((res) => res.json())
                          .catch((err) => console.log(err.message));
                        e.target.disabled = true;
                        e.target.textContent = '✔️'
                        e.target.style.backgroundColor = 'green';
                      }}>
                        ➕
                      </Button>
                    </Col>
                  </Row>
                ))
              }
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={() => setEnableChatInviting(false)}>🚫 Close</Button>
          </Modal.Footer>
        </Modal >
      }
      {
        <Modal show={enableChatModerating} backdrop='static' centered>
          <Modal.Header className='text-center'><h2>Moderate users</h2></Modal.Header>
          <Modal.Body>
            <div className='userListWrapper'>
              {
                userList.length > 0 && userList.map((user, id) => (
                  <Row className='text-center align-items-center m-2' key={id}>
                    <Col>{user.username}</Col>
                    <Col>
                      <Button
                        variant={!user.banned ? 'warning' : 'primary'}
                        onClick={async (e) => {
                          await fetch(
                            `api/chat/ban?chatId=${chatData.chat_id}&userId=${user.id}`,
                            {
                              method: 'PUT',
                              header: {
                                'Content-Type': 'application/json'
                              }
                            }
                          )
                            .then((res) => res.json())
                            .catch((err) => console.log(err.message));
                          e.target.disabled = true;
                          e.target.textContent = '✔️'
                          e.target.style.backgroundColor = 'green';
                        }}>
                        {!user.banned ? '🏴 Ban' : '🏳️ Unban'}
                      </Button>
                    </Col>
                  </Row>
                ))
              }
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={() => setEnableChatModerating(false)}>🚫 Close</Button>
          </Modal.Footer>
        </Modal >
      }
    </>
  )
}

export default ChatWindow;