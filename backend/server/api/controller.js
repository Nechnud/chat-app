const db = require("./db");
const passwordEncryptor = require("../../security/passwordEncryptor");
const acl = require("../../security/acl");

let connections = {};

const sse = async (req, res) => {
  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  // Add the response to open connections
  if (!connections[req.query.chatId]) {
    connections[req.query.chatId] = [res];
  } else {
    connections[req.query.chatId].push(res);
  }

  // listen for client disconnection and remove the client's response from the
  // open connections list
  req.on("close", () => {
    connections[req.query.chatId] = connections[req.query.chatId].filter(
      (openRes) => openRes != res
    );

    // message all open connections that a client disconnected
    broadcast("disconnect", {
      message: "client disconnected",
    });
  });

  // Set headers to mark that this is SSE and that we don't close the connection
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });

  // message all connected clients that this client connected
  broadcast("connect", {
    message: "clients connected: " + connections[req.query.chatId].length,
    chatId: req.query.chatId,
  });
};

// function to send message to all connected clients
function broadcast(event, data) {
  //console.log('broadcast event,', data);
  try {
    // loop through all open connections and send
    // some data without closing the connection (res.write)
    for (let res of connections[data.chatId]) {
      // syntax for a SSE message: 'event: message \ndata: "the-message" \n\n'
      res.write("event:" + event + "\ndata:" + JSON.stringify(data) + "\n\n");
    }
  } catch (err) {
    console.log(err.message);
  }
}

const registerUser = async (req, res) => {
  if (
    !req.body.username ||
    (req.body.username && req.body.username.length > 50) ||
    !req.body.password ||
    (req.body.password && req.body.password.length > 200) ||
    !req.body.password.match(
      /^(?=.*[\d!#$%&? "])(?=.*[A-Z])[a-zA-Z0-9!#$%&?]{8,}/
    )
  ) {
    res.status(400).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    const hashedPassword = passwordEncryptor(req.body.password);
    const query = await db.query(
      `
                INSERT INTO users (username, user_password, user_role) 
                VALUES($1, $2, $3)
                RETURNING *
            `,
      [req.body.username, hashedPassword, "user"]
    );

    if (query.rows.length === 0) {
      return res.status(403);
    }
    const user = query.rows[0];

    req.session.user = {
      id: user.id,
      username: user.username,
      userRole: user.user_role,
    };

    res.status(200).json({ user: req.session.user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const loginUser = async (req, res) => {
  if (!req.body.username || !req.body.password) {
    res.status(400).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    const query = await db.query(
      `
                SELECT id, username, user_role, user_password
                FROM users
                WHERE username = $1
            `,
      [req.body.username]
    );

    if (query.rows.length === 0) {
      res.status(403).json({ success: false, error: "User not found" });
      return;
    }
    const user = query.rows[0];

    const correctPassword =
      passwordEncryptor(req.body.password) === user.user_password;
    if (!correctPassword) {
      res.status(403).json({ success: false, error: "Incorrect password" });
      return;
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      userRole: user.user_role,
    };

    res.status(200).json({ user: req.session.user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getLoggedInUser = async (req, res) => {
  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  if (req.sessionID && req.session.user) {
    res.status(200).json({ user: req.session.user });
  } else {
    res.status(403).json({ success: false });
  }
};

const logoutUser = async (req, res) => {
  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    await req.session.destroy();
    res.status(200).json({ success: true, result: "Logged out" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

const getUsers = async (req, res) => {
  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    const query = await db.query(
      `
                SELECT id, username
                FROM users
                WHERE id != $1
                AND user_role = 'user'
                LIMIT $2
                ORDER BY username ASC
            `,
      [req.session.user.id, req.query.limit ? req.query.limit : 10]
    );

    res.status(200).json({ success: true, result: query.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const searchUsers = async (req, res) => {
  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    const query = await db.query(
      `
                SELECT id, username
                FROM users
                WHERE id != $1
                AND user_role = 'user'
                AND username LIKE $2
                ORDER BY username ASC
            `,
      [req.session.user.id, `%${req.query.searchValue}%`]
    );

    res.status(200).json({ success: true, result: query.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getChats = async (req, res) => {
  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    let query;
    if (req.session.user.userRole === "superadmin") {
      query = await db.query(
        `
                    WITH user_last_message AS(
                        SELECT chats.id AS chat_id, 
                            messages.message_timestamp, messages.from_id
                        FROM chats, messages 
                        WHERE chats.id = messages.chat_id
                        AND from_id = $1
                    )
                    SELECT id AS chat_id, created_by, chat_subject,
                        last_message.last_message_timestamp, 
                        user_latest_message.user_latest_message_timestamp
                    FROM chats
                    LEFT JOIN last_message
                    ON chats.id = last_message.chat_id
                    LEFT JOIN(
                        SELECT chat_id, 
                            MAX(message_timestamp) AS "user_latest_message_timestamp"
                        FROM user_last_message
                        GROUP BY(chat_id)
                    ) user_latest_message
                    ON user_latest_message.chat_id = chats.id
                `,
        [req.session.user.id]
      );
    } else {
      query = await db.query(
        `
                    WITH user_last_message AS(
                        SELECT chats.id AS chat_id,
                            messages.message_timestamp, messages.from_id
                        FROM chats, messages
                        WHERE chats.id = messages.chat_id
                        AND from_id = $1
                    )
                    SELECT c.id AS "chat_id", c.created_by, c.chat_subject,
                        cu.user_id, cu.banned, cu.invitation_accepted,
                        lm.last_message_timestamp, 
                        user_latest_message.user_latest_message_timestamp
                    FROM chat_users cu, chats c
                        LEFT JOIN last_message lm
                        ON c.id = lm.chat_id
                    LEFT JOIN(
                        SELECT chat_id, 
                            MAX(message_timestamp) AS "user_latest_message_timestamp"
                        FROM user_last_message
                        GROUP BY(chat_id)
                    ) user_latest_message
                    ON user_latest_message.chat_id = c.id
                    WHERE c.id = cu.chat_id
                    AND cu.user_id = $1
                    AND cu.invitation_accepted = true
                `,
        [req.session.user.id]
      );
    }

    res.status(200).json({ success: true, result: query.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const createChat = async (req, res) => {
  if (
    !req.body.subject ||
    (req.body.subject && req.body.subject.length > 200)
  ) {
    res.status(400).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    const query = await db.query(
      `
                INSERT INTO chats (created_by, chat_subject)
                VALUES ($1, $2)
                RETURNING *
            `,
      [req.session.user.id, req.body.subject]
    );

    res
      .status(200)
      .json({ success: true, result: "Chat created", chat: query.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getInvitationEligbleUsers = async (req, res) => {
  if (!req.query.chatId) {
    res.status(400).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    const query = await db.query(
      `
                SELECT id, username
                FROM users
                WHERE users.id != $1
                AND users.user_role = 'user'
                AND id NOT IN (
                    SELECT user_id
                    FROM chat_users
                    WHERE chat_id = $2
                )
                LIMIT $3
            `,
      [
        req.session.user.id,
        req.query.chatId,
        req.query.limit ? req.query.limit : 10,
      ]
    );

    res.status(200).json({ success: true, result: query.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const inviteToChat = async (req, res) => {
  if (!req.query.chatId || !req.query.userId) {
    res.status(400).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    await db.query(
      `
                INSERT INTO chat_users (chat_id, user_id)
                SELECT $1, $2
                WHERE NOT EXISTS(
                    SELECT *
                    FROM chat_users
                    WHERE chat_id = $1
                    AND user_id = $2
                )
                AND EXISTS(
                    SELECT id, created_by
                    FROM chats
                    WHERE id = $1
                    AND created_by = $3
                )
            `,
      [req.query.chatId, req.query.userId, req.session.user.id]
    );

    res.status(200).json({ success: true, result: "Chat invite sent" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getChatUsers = async (req, res) => {
  if (!req.query.chatId) {
    res.status(400).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    const query = await db.query(
      `
                SELECT users.id, users.username, chat_users.banned 
                FROM users, chats, chat_users
                WHERE users.id = chat_users.user_id
                AND chats.id = chat_users.chat_id
                AND chats.id = $1
                AND users.id != $2
            `,
      [req.query.chatId, req.session.user.id]
    );

    res.status(200).json({ success: true, result: query.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getChatInvites = async (req, res) => {
  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    const query = await db.query(
      `
                SELECT chats.id, chats.created_by, chats.chat_subject
                FROM chats, chat_users
                WHERE chats.id = chat_users.chat_id
                AND chat_users.user_id = $1
                AND chat_users.invitation_accepted = false
            `,
      [req.session.user.id]
    );

    res.status(200).json({ success: true, result: query.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const acceptChatInvite = async (req, res) => {
  if (!req.params.id) {
    res.status(400).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    await db.query(
      `
                UPDATE chat_users
                SET invitation_accepted = true
                WHERE chat_id = $1
                AND user_id = $2
            `,
      [req.params.id, req.session.user.id]
    );

    res
      .status(200)
      .json({ success: true, result: "Chat invitation accepcted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const banFromChat = async (req, res) => {
  if (!req.query.chatId || !req.query.userId) {
    res.status(400).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    let banUserQuery = { rowCount: 0 };
    if (req.session.user.userRole === "superadmin") {
      banUserQuery = await db.query(
        `
                    UPDATE chat_users
                    SET banned = NOT banned
                    WHERE chat_id = $1
                    AND user_id = $2
                `,
        [req.query.chatId, req.query.userId]
      );
    } else {
      banUserQuery = await db.query(
        `
                    UPDATE chat_users
                    SET banned = NOT banned
                    WHERE chat_id = $1
                    AND user_id = $2
                    AND EXISTS(
                        SELECT id 
                        FROM chats
                        WHERE created_by = $3
                        AND id = $1
                    )
                `,
        [req.query.chatId, req.query.userId, req.session.user.id]
      );
    }

    if (banUserQuery.rowCount === 1) {
      res
        .status(200)
        .json({ success: true, result: "User banned/unbanned from chat" });
    } else {
      res.status(405).json({ error: "Not allowed" });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const sendMessage = async (req, res) => {
  if (!req.body.chatId || !req.body.content || req.body.content.length > 999) {
    res.status(400).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    let message = req.body;
    message.fromId = req.session.user.id;
    message.timestamp = Date.now();
    if (
      req.body.content.endsWith("/ADMIN") &&
      req.session.user.userRole !== "superadmin"
    ) {
      req.body.content = req.body.content.slice(0, -6);
    }
    const query = await db.query(
      ` 
                INSERT INTO messages(chat_id, from_id, content, message_timestamp)
                SELECT $1, $2, $3, to_timestamp($4 / 1000.0)
                WHERE EXISTS(
                    SELECT 1
                    FROM chat_users
                    WHERE chat_id = $1
                    AND user_id = $2
                    AND banned != true
                )
                OR EXISTS(
                    SELECT 1
                    FROM users
                    WHERE id = $2
                    AND user_role = 'superadmin'
                )
                RETURNING id
            `,
      [
        req.body.chatId,
        req.session.user.id,
        req.body.content,
        message.timestamp,
      ]
    );

    if (query.rowCount > 0) {
      message.id = query.rows[0].id;
      broadcast("new-message", message);
      res.send("ok");
    } else {
      res.send("not ok");
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const getChatMessages = async (req, res) => {
  if (!req.params.id) {
    res.status(400).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    const query = await db.query(
      `
                SELECT users.username AS "from",
                    messages.id,
                    messages.content,
                    messages.message_timestamp AS "timestamp",
                    messages.from_id AS "fromId"
                FROM users, messages
                WHERE users.id = messages.from_id
                AND messages.chat_id = $1 
                AND EXISTS(
                    SELECT id 
                    FROM chat_users
                    WHERE chat_id = $1
                    AND user_id = $2
                    AND banned != true
                    OR EXISTS(
                        SELECT id
                        FROM users
                        WHERE id = $2
                        AND user_role = 'superadmin'
                    )
                )
                ORDER BY timestamp ASC
            `,
      [req.params.id, req.session.user.id]
    );

    res.status(200).json({ success: true, result: query.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const deleteMessage = async (req, res) => {
  if (!req.params.id) {
    res.status(400).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    await db.query(
      `
                DELETE
                FROM messages
                WHERE id = $1
            `,
      [req.params.id]
    );

    res.status(200).json({ success: true, result: "Message deleted" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const disconnectFromChat = async (req, res) => {
  if (!req.body) {
    res.status(500).json({ success: false, error: "Incorrect parameters" });
    return;
  }

  if (!acl(req.route.path, req)) {
    res.status(405).json({ error: "Not allowed" });
    return;
  }

  try {
    let message = req.body;
    message.event = "User disconnected";
    message.timestamp = Date.now();
    broadcast("disconnect", message);
    res.send("ok");
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  sse,
  registerUser,
  loginUser,
  getLoggedInUser,
  logoutUser,
  getUsers,
  searchUsers,
  getChats,
  createChat,
  getInvitationEligbleUsers,
  inviteToChat,
  getChatUsers,
  getChatInvites,
  acceptChatInvite,
  banFromChat,
  sendMessage,
  getChatMessages,
  deleteMessage,
  disconnectFromChat,
};
