const Users = require('../models/UsersInfo')
const Messages = require('../models/Message')
const RawUsers = require('../models/Users')

const { sendNotification } = require('../controllers/notificationSys')
const { triggerPush } = require('../controllers/triggerPush')

const Op = require('sequelize').Op


let connectedUsers = new Map();
// define events 
const events = (io) => {
    io.on('connection', (socket) => {
        const userId = socket.request.session.passport.user;

        //add connected user to the online users array
        connectedUsers.set(userId, socket.id)


        //console.log('new user connnected : ' + userId);
        //console.log(connectedUsers)

        // check if user exists in session
        if (socket.request.session.passport == 'undefined') {
            return
        }


        // messages 
        socket.on('newMessage', async (message) => {
            message.from = socket.request.session.passport.user;

            // search fot the receiver
            if (message.to) {
                //console.log(message.to)
                switch (message.to) {
                    case 'toAll': {
                        if (await isAdmin(message.from)) {
                            const msgSuccessfullySent = await sendToAll(message, io)
                            if (msgSuccessfullySent) {
                                socket.emit('status', { success: true })


                            } else {

                                socket.emit('status', { success: false })

                            }
                        } else {
                            socket.emit('status', { success: true })

                        }
                        break;
                    }
                    case 'student': {
                        if (await isAdmin(message.from) || await isCoach(message.from)) {
                            const msgSuccessfullySent = await sendToStudents(message, io)
                            if (msgSuccessfullySent) {
                                socket.emit('status', { success: true })

                            } else {
                                socket.emit('status', { success: false })

                            }
                        } else {
                            socket.emit('status', { success: false })

                        }
                        break
                    }
                    case 'coach': {
                        if (await isAdmin(message.from) || await isCoach(message.from)) {
                            const msgSuccessfullySent = await sendToCoach(message, io)
                            if (msgSuccessfullySent) {

                                socket.emit('status', { success: true })
                            } else {
                                socket.emit('status', { success: false })

                            }
                        } else {
                            socket.emit('status', { success: false })

                        }
                        break
                    }

                    default: {
                        //post req
                        sendMessage(message).then(async message => {
                            if (message) {
                                //get socket id 
                                const socketId = connectedUsers.get(message.to);

                                //format message
                                let msg = await formatMessage(message)

                                //broadcast message
                                io.to(socketId).emit('newMessage', msg);

                                // FIXME: notification
                                let notification = await sendNotification(message.to, msg.text)

                                //push notification
                                let payload = {
                                    data: `${msg.senderName} has sent you a message.`,

                                }
                                let push = await triggerPush(message.to, payload)

                                if (notification) {
                                    delete msg.id
                                    delete msg.to
                                    delete msg.from
                                    msg.notificationId = notification.id
                                    io.to(socketId).emit('msgNotification', msg);
                                }

                                console.log('notification has been')
                                socket.emit('status', { success: true })
                            } else {
                                socket.emit('status', { success: false })

                            }
                        });
                        break;
                    }
                }
            }

        })

        //disconnect 
        socket.on('disconnect', () => {
            const userId = socket.request.session.passport
            if (socket.request.session.passport == null) {
                return
            }

            connectedUsers.delete(userId.user);
            //console.log(`user ${userId.user} has disconnected`)
            //console.log(connectedUsers)
        })

        //TODO: notifications

    })

}


//init socket 
const init = (app, session) => {

    const server = require('http').Server(app);
    const io = require('socket.io')(server);

    //grant access to request infos
    io.use((socket, next) => {
        session(socket.request, socket.request.res, next)
    })

    //events
    events(io);

    return server
}

module.exports = { init, connectedUsers };


//******************** helper functions : 

const sendMessage = async (message) => {
    // search fot the receiver
    try {
        const user = await Users.findOne({ where: { username: message.to } });
        if (user) {
            try {
                message.to = user.dataValues.id;
                const msg = await Messages.create(message);
                message.id = msg.id
                message.isRead = msg.isRead
                return message

            } catch (err) {
                console.log(err);

            }
        } else {
            return null

        }
    } catch (err) {
        console.log(err)
    }


}

const formatMessage = async (msg) => {

    let sender = await Users.findByPk(msg.from);
    sender = sender.dataValues;
    msg.senderName = sender.firstName + ' ' + sender.lastName;
    msg.senderUsername = sender.username;
    msg.senderAvatar = sender.avatar;
    return msg;

}

const sendToAll = async (message, io) => {
    try {
        let users = await Users.findAll(
            {
                where: {
                    [Op.not]: { userId: message.from }
                }
            },
            { attributes: ['userId'] })
        if (users.length > 0) {
            users.forEach(async user => {
                try {
                    message.to = user.dataValues.userId;
                    const msg = await Messages.create(message);
                    message.id = msg.id
                    message.isRead = msg.isRead
                    //get socket id of connected user
                    const socketId = connectedUsers.get(message.to);

                    //format message
                    let msgFormated = await formatMessage(message)

                    //broadcast message
                    io.to(socketId).emit('newMessage', msgFormated);

                    //notification
                    let notification = await sendNotification(message.to, msgFormated)
                    //push notification
                    let payload = {
                        data: `${msgFormated.senderName} has sent you a message.`,

                    }
                    let push = await triggerPush(message.to, payload)

                    if (notification) {
                        delete msgFormated.id
                        delete msgFormated.to
                        delete msgFormated.from
                        msg.notificationId = notification.id

                        io.to(socketId).emit('msgNotification', msgFormated);
                    }

                } catch (err) {
                    console.log(err);
                }
            })
            return true
        }
    } catch (error) {
        console.log(error)
        return false
    }

}

const sendToStudents = async (message, io) => {
    try {
        let users = await RawUsers.findAll({
            where: {
                groupId: 2
            }
        },
            { attributes: ['id'] })
        users.forEach(async (user) => {
            try {
                message.to = user.dataValues.id
                const msg = await Messages.create(message);
                message.id = msg.id
                message.isRead = msg.isRead
                //get socket id of connected user
                const socketId = connectedUsers.get(message.to);

                //format message
                let msgFormated = await formatMessage(message)

                //broadcast message
                io.to(socketId).emit('newMessage', msgFormated);

                //notification
                let notification = await sendNotification(message.to, msgFormated)

                //push notification
                let payload = {
                    data: `${msgFormated.senderName} has sent you a message.`,

                }
                let push = await triggerPush(message.to, payload)
                if (notification) {
                    delete msgFormated.id
                    delete msgFormated.to
                    delete msgFormated.from
                    msg.notificationId = notification.id

                    io.to(socketId).emit('msgNotification', msgFormated);
                }

            } catch (error) {
                console.log(error)
            }
        })
        return true

    } catch (error) {
        console.log(error)
        return false
    }
}

const sendToCoach = async (message, io) => {

    try {
        let users = await RawUsers.findAll({
            where: {
                groupId: 1,
                [Op.and]: { [Op.not]: { id: message.from } }
            }
        },
            { attributes: ['id'] })
        if (users.length > 0) {
            users.forEach(async (user) => {
                try {
                    message.to = user.dataValues.id
                    const msg = await Messages.create(message);
                    message.id = msg.id
                    message.isRead = msg.isRead
                    //get socket id of connected user
                    const socketId = connectedUsers.get(message.to);

                    //format message
                    let msgFormated = await formatMessage(message)

                    //broadcast message
                    io.to(socketId).emit('newMessage', msgFormated);
                    //notification
                    let notification = await sendNotification(message.to, msgFormated)

                    //push notification
                    let payload = {
                        data: `${msgFormated.senderName} has sent you a message.`,

                    }
                    let push = await triggerPush(message.to, payload)
                    if (notification) {
                        delete msgFormated.id
                        delete msgFormated.to
                        delete msgFormated.from
                        msg.notificationId = notification.id

                        io.to(socketId).emit('msgNotification', msgFormated);
                    }

                } catch (error) {
                    console.log(error)
                }
            })
            return true
        } else {
            console.log('No coaches available')
            return false
        }

    } catch (error) {
        console.log(error)
        return false
    }
}


//middleware functions 
const isAdmin = async (id) => {
    let user = await RawUsers.findByPk(id)
    return user.dataValues.groupId === 0
}

const isCoach = async (id) => {
    let user = await RawUsers.findByPk(id)
    return user.dataValues.groupId === 1
}


