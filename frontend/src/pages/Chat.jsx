import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Button from 'react-bootstrap/Button';
import ListGroup from 'react-bootstrap/ListGroup';
import Badge from 'react-bootstrap/Badge';
import Modal from 'react-bootstrap/Modal';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';
import ChatWindow from '../components/ChatWindow';
import ChatCreate from '../components/ChatCreate';
import UserList from '../components/UserList';

const Chat = ({ userData }) => {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [chatInvitations, setChatInvitations] = useState([]);
  const [showChatInvitations, setShowChatInvitations] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [showUsers, setShowUsers] = useState(false);
  const [newChat, setNewChat] = useState(false);

  useEffect(() => {
    if (!userData) {
      navigate('/');
    }

    const getChats = async () => {
      await fetch(
        `api/chats`,
        {
          method: 'GET'
        }
      )
        .then((res) => res.json())
        .then((data) => setChats(data.result))
        .catch((err) => console.log(err.message));
    }

    const getChatInvitations = async () => {
      await fetch(
        'api/chat/invites',
        {
          method: 'GET'
        }
      )
        .then((res) => res.json())
        .then((data) => setChatInvitations(data.result))
        .catch((err) => console.log(err.message));
    }

    getChats();
    getChatInvitations();
  }, [showChatInvitations, selectedChat]);

  const sortChatsByName = () => {
    let sortedChats = chats.sort((a, b) => {
      const chatSubjectA = a.chat_subject.toUpperCase();
      const chatSubjectB = b.chat_subject.toUpperCase();
      if (chatSubjectA < chatSubjectB) {
        return -1;
      }
      if (chatSubjectA > chatSubjectB) {
        return 1;
      }
      return 0;
    });
    setChats([]);
    setChats([...sortedChats]);
  }

  const sortChatsByLatestMessage = () => {
    let sortedChats = chats.sort((a, b) => {
      const msgTimestampA = new Date(a.last_message_timestamp);
      const msgTimestampB = new Date(b.last_message_timestamp);
      if (msgTimestampA > msgTimestampB) {
        return -1;
      }
      if (msgTimestampA < msgTimestampB) {
        return 1;
      }
      return 0;
    });
    setChats([]);
    setChats([...sortedChats]);
  }

  const sortChatsByUsersLatestMessage = () => {
    let sortedChats = chats.sort((a, b) => {
      const msgTimestampA = new Date(a.user_latest_message_timestamp);
      const msgTimestampB = new Date(b.user_latest_message_timestamp);
      if (msgTimestampA > msgTimestampB) {
        return -1;
      }
      if (msgTimestampA < msgTimestampB) {
        return 1;
      }
      return 0;
    });
    setChats([]);
    setChats([...sortedChats]);
  }

  const renderTooltip = (props) => (
    <Tooltip id='button-tooltip' {...props}>Chat owner</Tooltip>
  );

  return (
    <>
      <Badge onClick={() => setShowUsers(!showUsers)} className='p-2 m-2 setShowUsersBadge'>
        {!showUsers ? 'Show users' : 'Hide users'}
      </Badge>
      {showUsers && <UserList />}
      <Card className='p-2 m-2 text-center'>
        <Row className='align-items-center'>
          <Col><h1>Chats</h1></Col>
          <Col>
            <Button
              onClick={() => setShowChatInvitations(true)}
              disabled={!chatInvitations.length > 0 ? true : false}
            >
              {!chatInvitations.length > 0 ? 'Pending invites' : `🔔 Pending invites (${chatInvitations.length})`}
            </Button>
          </Col>
        </Row>
        <hr></hr>
        {
          !selectedChat &&
          <Row>
            <Col><div>Order chats by</div></Col>
            <Col><div className='orderByDiv' onClick={() => sortChatsByName()}>Name</div></Col>
            <Col><div className='orderByDiv' onClick={() => sortChatsByLatestMessage()}>Latest message</div></Col>
            <Col><div className='orderByDiv' onClick={() => sortChatsByUsersLatestMessage()}>My latest message</div></Col>
          </Row>
        }
        <ListGroup className='p-2 m-2 chatListGroup'>
          {
            !selectedChat && chats.length > 0 && !newChat && chats.map((chat, id) => (
              <Row key={id}>
                <ListGroup.Item
                  disabled={chat.banned}
                  onClick={() => setSelectedChat(chat)}
                  className='chatListGroupItem'
                >
                  {chat.chat_subject}
                  {chat.banned && <Badge pill bg='danger' className='ms-4'>Banned</Badge>}
                  {
                    chat.created_by === userData.id &&
                    <OverlayTrigger
                      delay={{ show: 250, hide: 400 }}
                      overlay={renderTooltip}
                    >
                      <Badge pill className='ms-4'>👑</Badge>
                    </OverlayTrigger>
                  }
                </ListGroup.Item>
              </Row>
            ))
          }
        </ListGroup>
        {
          !chats.length > 0 && <div>No chats found</div>
        }
        {
          selectedChat ?
            <ChatWindow
              chatData={selectedChat}
              userData={userData}
              setSelectedChatCallback={setSelectedChat}
            />
            :
            <Button onClick={() => setNewChat(!newChat)}>
              {!newChat ? 'New chat' : '🚫 Close'}
            </Button>
        }
        {
          !selectedChat && newChat &&
          <ChatCreate
            setSelectedChatCallback={setSelectedChat}
            setNewChatCallback={setNewChat}
            setChatsCallback={setChats}
          />
        }
      </Card>
      {
        <Modal show={showChatInvitations} backdrop='static' centered>
          <Modal.Header className='text-center'><h2>Chat invitations</h2></Modal.Header>
          <Modal.Body>
            <div className='listWrapper'>
              {
                chatInvitations.length > 0 && chatInvitations.map((chat, id) => (
                  <Row className='text-center align-items-center m-2' key={id}>
                    <Col>{chat.chat_subject}</Col>
                    <Col>
                      <Button
                        onClick={async (e) => {
                          await fetch(
                            `api/chat/accept-invite/${chat.id}`,
                            {
                              method: 'PUT',
                              headers: {
                                'Content-Type': 'application/json'
                              }
                            }
                          )
                            .then((res) => res.json())
                            .catch((err) => console.log(err.message));
                          e.target.disabled = true;
                          e.target.textContent = '✔️'
                          e.target.style.backgroundColor = 'green';
                        }}
                      >
                        Join
                      </Button>
                    </Col>
                  </Row>
                ))
              }
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button onClick={() => setShowChatInvitations(false)} >🚫 Close</Button>
          </Modal.Footer>
        </Modal>
      }
    </>
  )
}

export default Chat;