import React, { useEffect, useState } from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import ListGroup from 'react-bootstrap/ListGroup';

const UserList = () => {
  const [userList, setUserList] = useState([]);
  const [searchedUsername, setSearchedUsername] = useState('');

  useEffect(() => {
    const getUserList = async () => {
      await fetch(
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

  return (
    <>
      <Card className='p-2 m-2'>
        <Form className='p-2 m-2'>
          <Form.Group>
            <Form.Control
              autoComplete='off'
              className='my-2'
              type='text'
              name='username'
              value={searchedUsername}
              placeholder='Search...'
              onChange={(event) => setSearchedUsername(event.target.value)}
            />
          </Form.Group>
        </Form>
        <Row className='ms-2'><Col><h4>Users</h4></Col></Row>
        <ListGroup className='p-2 m-2 usersListGroup'>
          {
            userList && userList.length > 0 && userList.map((user, id) => (
              <Row key={id}>
                <Col>
                  <ListGroup.Item className='usersListGroupItem'>{user.username}</ListGroup.Item>
                </Col>
              </Row>
            ))
          }
        </ListGroup>
      </Card>
    </>
  );
}

export default UserList;