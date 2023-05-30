# Teamgrow backend_admin

## How to run
### Dev  
`npm run dev`
### Production
`npm run start`
### Required Env Variables

Set these env variables in `/var/www/teamgrow/bakend_admin`.
Files, docs, db, test db are stored in the following paths defined in `config/path`.

```
  module.exports.FILES_PATH = '/var/www/teamgrow/files/'
```

#### PORT=3000

## Endpoints

### Sign Up. 
   
  POST `/api/user`  
   
  Body: 
  ```
  {
    "email": "user@email.com",
    "user_name": "user",
    "password": "pwd"
    "time_zone": "+08:00"
    "cell_phone": "12345678",
    "email_signature": "",
    "notification": "",
    "picture_profile":"http://localhost:3000/api/file/949b4d70-a48d-11e8-a12f-dd03f72627a4.png"
  }
  ```

  Response:  
  
  HTTP Status: 200
  ```
    {
        "status": true,
        "data": {
            "id": 2,
            "email": "test1@test.com",
            "user_name": "A",
            "time_zone": "+08:00",
            "email_signature": "a",
            "notification": 1,
            "picture_profile": "http://localhost:3000/api/file/949b4d70-a48d-11e8-a12f-dd03f72627a4.png"
            "updatedAt": "2019-02-21T14:38:33.188Z",
            "createdAt": "2019-02-21T14:38:33.188Z"
        }
    }
  ```

  HTTP Status: 500
  ```
    {
        "status": false,
        "error": [
            {
                "message": "email must be unique",
                "type": "unique violation",
                "path": "email",
                "value": "test1@test.com",
                "origin": "DB",
                "instance": {},
                "validatorKey": "not_unique",
                "validatorName": null,
                "validatorArgs": []
            }
        ]
    }
  ```

### Login.
   
   POST `/api/user/login`  
   
   Body: 
   ```
   {
       "email": // Email or user_name,
       "password": "pwd"
   }
   ```

   Response:

   HTTP Status: 200  
   ```
    {
        "status": true,
        "data": {
            "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJpYXQiOjE1MzQ0MzAwNzV9.ObSw3PxO03keexi6Lb7BXSXtbt8xmdoUhjFpSWbyj3w",
            "user": {
                "id": 1,
                "user_name": "A",
                "email": "test@test.com",
                "cell_phone": "1234567890",
                "time_zone": "GMT+0100",
                "email_signature": "a",
                "notification": 1,
                "picture_profile": "http://localhost:3000/api/file/949b4d70-a48d-11e8-a12f-dd03f72627a4.png",
                "createdAt": "2019-02-21T14:27:19.854Z",
                "updatedAt": "2019-02-21T14:27:19.854Z"
            }
        }
    }
   ```
   HTTP Status: 401  

   ```
    {
      "status": false,
      "error": "Invalid email or password!"
    }
   ``` 

### FollowUp APIs

### User APIs

#### PUT `/api/user/me`  

    Edit own profile by JWT  

    Body: 
    ```
    {
        "user_name": "superweb3",
        "email": "superwebtop@outlook.com",
        "password": "12345",
        "cell_phone":"12323232222",
        "time_zone":"+8:00",
        "email_signature":"a",
        "notification": 1,
        "picture_profile":"http://localhost:3000"
    }
    ```

    Response:  

    HTTP Status: 200  
    ```  
    {
        "status": true,
        "data": {
            "_id": "5c715b0fccf14717986c85dc",
            "user_name": "superweb3",
            "email": "superwebtop@outlook.com",
            "cell_phone": "12323232222",
            "time_zone": "+8:00",
            "email_signature": "a",
            "notification": 1,
            "picture_profile": "http://localhost:3000",
            "created_at": "1970-01-01T03:25:23.232Z",
            "__v": 0
        }
    }
    ```

#### POST `/new-password'

Reset password by old password

  Body:
  ```
  {
    old_password,
    new_password
  }
  ```
 
#### POST `/api/follow`  
   
   Body: 
   ```
   {
       "due_date": "2019-02-21T14:27:19.854Z",
       "content": "a",
       "contact": "5c71a62d8e8bea5ba7da91d2",
       "type": "contact",
       "reminder": 30
   }
   ```

   Response:

   HTTP Status: 200  
   ```
    {
        "status": true,
        "data": {
            "user": [
                "5c715b0fccf14717986c85dc"
            ],
            "contact": [
                "5c71c9d6cf6b7d7fae539593"
            ],
            "_id": "5c7d488f9b22a15faec8eda9",
            "content": "email",
            "due_date": "2019-02-23T22:31:50.491Z",
            "updated_at": "2019-03-04T15:47:27.266Z",
            "created_at": "2019-03-04T15:47:27.266Z",
            "__v": 0,
            "activity": {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "note": [],
                "email": [],
                "contact": [
                    "5c71c9d6cf6b7d7fae539593"
                ],
                "_id": "5c7d488f9b22a15faec8edaa",
                "content": "hello added follow up",
                "created_at": "2019-03-04T15:47:27.332Z",
                "updated_at": "2019-03-04T15:47:27.332Z",
                "__v": 0
            }
        }
}
   ```
   HTTP Status: 401  

   ```
    {
      "status": false,
      "error": "FollowUp doesn`t exist"
    }
   ``` 

#### GET `/api/follow/date?due_date=`

due_date:  
  `overdue`, `today`, `tomorrow`, `next_week`, `next_month`, `future`

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": [
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "_id": "5c71a62d8e8bea5ba7da91d2",
                "due_date": "1970-01-01T00:18:31.111Z",
                "status": "1",
                "updated_at": "1970-01-01T00:18:31.111Z",
                "created_at": "1970-01-01T00:18:31.111Z",
                "__v": 0,
                "contact": null
            },
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "_id": "5c71b47385cdc7641d41247f",
                "due_date": "1970-01-01T00:18:31.111Z",
                "status": "1",
                "updated_at": "1970-01-01T00:18:31.111Z",
                "created_at": "1970-01-01T00:18:31.111Z",
                "__v": 0,
                "contact": null
            }
        ]
    }
    
#### GET `/api/follow`

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": [
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "contact": [],
                "_id": "5c71a62d8e8bea5ba7da91d2",
                "due_date": "2019-02-21T14:27:19.854Z",
                "status": "1",
                "updated_at": "2019-02-21T14:27:19.854Z",
                "created_at": "2019-02-21T14:27:19.854Z",
                "__v": 0
            },
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "contact": [],
                "_id": "5c71b47385cdc7641d41247f",
                "due_date": "2019-02-21T14:27:19.854Z",
                "status": "1",
                "updated_at": "2019-02-21T14:27:19.854Z",
                "created_at": "2019-02-21T14:27:19.854Z",
                "__v": 0
            }
        ]
    }

#### PUT `/api/follow/checked/:id`

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": {
            "user": [
                "5c8697b0daf5860df951409b"
            ],
            "follow_ups": [
                "5c8710832be4a44e7b802d13"
            ],
            "notes": [],
            "phone_logs": [],
            "email": [],
            "contacts": [
                "5c870f9edfa5524ac7e5ecab"
            ],
            "_id": "5c8711a58c51f050a57536bb",
            "content": "this is followup",
            "type": "follow_ups",
            "created_at": "2019-03-12T01:55:49.035Z",
            "updated_at": "2019-03-12T01:55:49.035Z",
            "__v": 0,
            "contact": {
                "user": [
                    "5c8697b0daf5860df951409b"
                ],
                "tag": [
                    "interesting"
                ],
                "_id": "5c870f9edfa5524ac7e5ecab",
                "first_name": "Super",
                "last_name": "WebTop",
                "email": "amazingksill8001@gmail.com",
                "cell_phone": "111111111",
                "brokerage": "Max",
                "recruiting_stage": "cold call",
                "created_at": "2019-03-12T01:47:10.800Z",
                "updated_at": "2019-03-12T01:47:10.800Z",
                "__v": 0
            }
        }
    }
    

### Contact APIs

#### GET `/api/contact`

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": [
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "_id": "5c71c9d6cf6b7d7fae539593",
                "first_name": "Super",
                "last_name": "WebTop",
                "email": "amazingksill8001@gmail.com",
                "cell_phone": "111111111",
                "brokerage": "Max",
                "tag": "interesting",
                "recruiting_stage": "cold call",
                "updated_at": "2019-02-23T22:31:50.491Z",
                "created_at": "2019-02-23T22:31:50.491Z",
                "__v": 0
            },
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "_id": "5c79a6da1ae03d1925eedfa2",
                "first_name": "Super",
                "last_name": "WebTop",
                "email": "amazingksill8001@gmail.com",
                "cell_phone": "111111111",
                "brokerage": "Max",
                "tag": "interesting",
                "recruiting_stage": "cold call",
                "created_at": "2019-03-01T21:40:42.606Z",
                "updated_at": "2019-03-01T21:40:42.606Z",
                "__v": 0
            }
        ]
    }
    ```
    HTTP Status: 401  

    ```
    {
        "status": false,
        "error": "Contact doesn`t exist"
    }
    ``` 

#### POST `/api/contact`
   
   Body: 
   ```
    {
        "first_name":"Super",
        "last_name":"WebTop",
        "email": "amazingksill8001@gmail.com",
        "cell_phone": "111111111",
        "brokerage": "Max",
        "tag": "interesting",
        "recruiting_stage": "cold call"
    }
   ```

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": {
            "user": [
                "5c715b0fccf14717986c85dc"
            ],
            "_id": "5c7d48c49b22a15faec8edab",
            "first_name": "Super",
            "last_name": "WebTop",
            "email": "amazingksill8001@gmail.com",
            "cell_phone": "111111111",
            "brokerage": "Max",
            "tag": "interesting",
            "recruiting_stage": "cold call",
            "created_at": "2019-03-04T15:48:20.383Z",
            "updated_at": "2019-03-04T15:48:20.383Z",
            "__v": 0,
            "activity": {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "note": [],
                "email": [],
                "contact": [
                    "5c7d48c49b22a15faec8edab"
                ],
                "_id": "5c7d48c49b22a15faec8edac",
                "content": "hello added contact",
                "created_at": "2019-03-04T15:48:20.408Z",
                "updated_at": "2019-03-04T15:48:20.408Z",
                "__v": 0
            }
        }
    }

#### GET `/api/contact/:id`
   
   Body: 
   ```
    {
        "first_name":"Super",
        "last_name":"WebTop",
        "email": "amazingksill8001@gmail.com",
        "cell_phone": "111111111",
        "brokerage": "Max",
        "tag": "interesting",
        "recruiting_stage": "cold call"
    }
   ```

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": {
            "user": [
                "5c715b0fccf14717986c85dc"
            ],
            "_id": "5c71c9d6cf6b7d7fae539593",
            "first_name": "Super",
            "last_name": "WebTop",
            "email": "amazingksill8001@gmail.com",
            "cell_phone": "111111111",
            "brokerage": "Max",
            "tag": "interesting",
            "recruiting_stage": "cold call",
            "updated_at": "2019-02-23T22:31:50.491Z",
            "created_at": "2019-02-23T22:31:50.491Z",
            "__v": 0,
            "follow_up": [
                {
                    "user": [
                        "5c715b0fccf14717986c85dc"
                    ],
                    "contact": [
                        "5c71c9d6cf6b7d7fae539593"
                    ],
                    "status": [],
                    "_id": "5c77eda6bf1cae22d1786c5d",
                    "content": "email",
                    "updated_at": "2019-02-28T14:18:14.361Z",
                    "created_at": "2019-02-28T14:18:14.361Z",
                    "__v": 0
                },
                {
                    "user": [
                        "5c715b0fccf14717986c85dc"
                    ],
                    "contact": [
                        "5c71c9d6cf6b7d7fae539593"
                    ],
                    "status": [
                        1
                    ],
                    "_id": "5c7d488f9b22a15faec8eda9",
                    "content": "email",
                    "due_date": "2019-02-23T22:31:50.491Z",
                    "updated_at": "2019-03-04T15:47:27.266Z",
                    "created_at": "2019-03-04T15:47:27.266Z",
                    "__v": 1
                }
            ],
            "activity": [
                [
                    {
                        "_id": "5c867348002dfba675c27c5a",
                        "user": [
                            "5c715b0fccf14717986c85dc"
                        ],
                        "notes": [
                            "5c867348002dfba675c27c59"
                        ],
                        "phone_log": [],
                        "email": [],
                        "contact": [
                            "5c71c9d6cf6b7d7fae539593"
                        ],
                        "content": "superweb3 added note",
                        "type": "notes",
                        "created_at": "2019-03-11T14:40:08.219Z",
                        "updated_at": "2019-03-11T14:40:08.219Z",
                        "__v": 0,
                        "activity_detail": [
                            {
                                "_id": "5c867348002dfba675c27c59",
                                "user": [
                                    "5c715b0fccf14717986c85dc"
                                ],
                                "contact": [
                                    "5c71c9d6cf6b7d7fae539593"
                                ],
                                "content": "interesting",
                                "updated_at": "2019-03-11T14:40:08.200Z",
                                "created_at": "2019-03-11T14:40:08.200Z",
                                "__v": 0
                            }
                        ]
                    }
                ]
            ]
        }
    }

#### PUT `/api/contact/:id`
   
   Body: 
   ```
    {
        "first_name":"Super",
        "last_name":"WebTop",
    }
   ```

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": {
            "user": [
                "5c8697b0daf5860df951409b"
            ],
            "tag": [
                "interesting"
            ],
            "_id": "5c8716e5390f6c5a3726e3b8",
            "first_name": "Amazing2",
            "last_name": "WebTop",
            "email": "amazingksill8002@gmail.com",
            "cell_phone": "111111111",
            "brokerage": "Max",
            "recruiting_stage": "cold call",
            "created_at": "2019-03-12T02:18:13.146Z",
            "updated_at": "2019-03-12T02:20:25.222Z",
            "__v": 0
        }
    }

#### DELETE `/api/contact/:id`

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
    }

#### GET `/api/contact/batch`

    Body: 
    ```
        {
            "content": "this is content",
            "subject": "this is subject",
            "email_list": ["a@a.com","b@b.com"]
        }
    ```
    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": [
            "Successful send to a@a.com",
            "Successful send to b@b.com"
        ]
    }


### Activity APIs

#### GET `/api/activity`

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": [
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "note": [],
                "email": [],
                "_id": "5c77fc302a67613520fac4b7",
                "content": "email",
                "updated_at": "2019-02-28T15:20:16.119Z",
                "created_at": "2019-02-28T15:20:16.119Z",
                "__v": 0,
                "contact": {
                    "user": [
                        "5c715b0fccf14717986c85dc"
                    ],
                    "_id": "5c71c9d6cf6b7d7fae539593",
                    "first_name": "Super",
                    "last_name": "WebTop",
                    "email": "amazingksill8001@gmail.com",
                    "cell_phone": "111111111",
                    "brokerage": "Max",
                    "tag": "interesting",
                    "recruiting_stage": "cold call",
                    "updated_at": "2019-02-23T22:31:50.491Z",
                    "created_at": "2019-02-23T22:31:50.491Z",
                    "__v": 0
                }
            },
        ]
    }

    ```
    HTTP Status: 401  

    ```
    {
        "status": false,
        "error": "Activity doesn`t exist"
    }
    ``` 

#### POST `/api/activity`

   Body: 
   ```
    {
        "contact": "5c71a62d8e8bea5ba7da91d2",
        "content": "email",
        "email": "5c715b0fccf14717986c85dc",
        "note": "5c715b0fccf14717986c85dc"
    }
   ```

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": [
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "note": [],
                "email": [],
                "contact": [
                    "5c71a62d8e8bea5ba7da91d2"
                ],
                "_id": "5c729fbe861fe7dbeb4040bb",
                "content": "email",
                "updated_at": "2019-02-24T13:44:30.173Z",
                "created_at": "2019-02-24T13:44:30.173Z",
                "__v": 0
            },
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "note": [],
                "email": [],
                "contact": [
                    "5c71a62d8e8bea5ba7da91d2"
                ],
                "_id": "5c72a05049e4e3dd35401b55",
                "content": "email",
                "updated_at": "2019-02-24T13:46:56.347Z",
                "created_at": "2019-02-24T13:46:56.347Z",
                "__v": 0
            }
        ]
    }

#### GET `/api/activity/last`

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": [
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "note": [],
                "email": [],
                "contact": [
                    "5c71a62d8e8bea5ba7da91d2"
                ],
                "_id": "5c729fbe861fe7dbeb4040bb",
                "content": "email",
                "updated_at": "2019-02-24T13:44:30.173Z",
                "created_at": "2019-02-24T13:44:30.173Z",
                "__v": 0
            },
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "note": [],
                "email": [],
                "contact": [
                    "5c71a62d8e8bea5ba7da91d2"
                ],
                "_id": "5c72a05049e4e3dd35401b55",
                "content": "email",
                "updated_at": "2019-02-24T13:46:56.347Z",
                "created_at": "2019-02-24T13:46:56.347Z",
                "__v": 0
            }
        ]
    }


### Note APIs

#### GET `/api/note?contact=`

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": {
            "user": [
                "5c715b0fccf14717986c85dc"
            ],
            "contact": [
                "5c71a62d8e8bea5ba7da91d2"
            ],
            "_id": "5c72b10e262863105aa56885",
            "content": "interesting",
            "updated_at": "2019-02-24T14:58:22.364Z",
            "created_at": "2019-02-24T14:58:22.364Z",
            "__v": 0
        }
    }

    ```
    HTTP Status: 401  

    ```
    {
        "status": false,
        "error": "Activity doesn`t exist"
    }
    ``` 

#### POST `/api/note`

   Body: 
   ```
    {
        "content":"interesting",
        "contact": "5c71a62d8e8bea5ba7da91d2"
    }
   ```

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": {
            "user": [
                "5c715b0fccf14717986c85dc"
            ],
            "contact": [
                "5c71a62d8e8bea5ba7da91d2"
            ],
            "_id": "5c72b10e262863105aa56885",
            "content": "interesting",
            "updated_at": "2019-02-24T14:58:22.364Z",
            "created_at": "2019-02-24T14:58:22.364Z",
            "__v": 0
        }
    }

### Tag APIs

#### GET `/api/tag`

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": [
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "_id": "5c769df6f600561d9388b44b",
                "content": "interesting",
                "updated_at": "2019-02-27T14:25:58.610Z",
                "created_at": "2019-02-27T14:25:58.610Z",
                "__v": 0
            }
        ]
    }

    ```
    HTTP Status: 401  

    ```
    {
        "status": false,
        "error": "Tag doesn`t exist"
    }
    ``` 

#### POST `/api/tag`

   Body: 
   ```
    {
        "content":"interesting"
    }
   ```

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": {
            "_id": "5c769d65220d181cae6c5873",
            "content": "interesting",
            "updated_at": "2019-02-27T14:23:33.505Z",
            "created_at": "2019-02-27T14:23:33.505Z",
            "__v": 0
        }
    }

### Appointment APIs

#### GET `/api/appointment`

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": [
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "contact": [
                    "5c71a62d8e8bea5ba7da91d2"
                ],
                "guest": [],
                "type": "",
                "_id": "5c76b82ce545eb2ec2cb8f1a",
                "title": "Title",
                "description": "Description",
                "location": "US",
                "due_start": "2019-02-27T14:25:58.610Z",
                "due_end": "2019-02-27T14:25:58.610Z",
                "updated_at": "2019-02-27T16:17:48.463Z",
                "created_at": "2019-02-27T16:17:48.463Z",
                "__v": 0
            },
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "contact": [
                    "5c71a62d8e8bea5ba7da91d2"
                ],
                "guest": [
                    "1.1@gmail.com",
                    "2.2@gmail.com"
                ],
                "type": "",               
                "_id": "5c808248829c2cbe0cdb693b",
                "title": "Title",
                "description": "Description",
                "location": "US",
                "due_start": "2019-02-27T14:25:58.610Z",
                "due_end": "2019-02-27T14:25:58.610Z",
                "updated_at": "2019-03-07T02:30:32.378Z",
                "created_at": "2019-03-07T02:30:32.378Z",
                "__v": 0
            }
        ]
    }

    ```
    HTTP Status: 401  

    ```
    {
        "status": false,
        "error": "Tag doesn`t exist"
    }
    ``` 

#### POST `/api/appointment`

   Body: 
   ```
    {
        "title":"Title",
        "description": "Description",
        "location":"US",
        "due_start": "2019-02-27T14:25:58.610Z",
        "due_end": "2019-02-27T14:25:58.610Z",
        "contact":"5c71a62d8e8bea5ba7da91d2"
    }
   ```

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": {
            "user": [
                "5c715b0fccf14717986c85dc"
            ],
            "contact": [
                "5c71a62d8e8bea5ba7da91d2"
            ],
            "guest": [
                "guest1@gmail.com",
                "guest2@gmail.com"
            ],
            "_id": "5c808248829c2cbe0cdb693b",
            "title": "Title",
            "description": "Description",
            "location": "US",
            "due_start": "2019-02-27T14:25:58.610Z",
            "due_end": "2019-02-27T14:25:58.610Z",
            "updated_at": "2019-03-07T02:30:32.378Z",
            "created_at": "2019-03-07T02:30:32.378Z",
            "__v": 0,
            "activity": {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "note": [],
                "email": [],
                "contact": [
                    "5c71a62d8e8bea5ba7da91d2"
                ],
                "_id": "5c808248829c2cbe0cdb693c",
                "content": "hello added appointment",
                "type": "appointment",
                "created_at": "2019-03-07T02:30:32.516Z",
                "updated_at": "2019-03-07T02:30:32.516Z",
                "__v": 0
            }
        }
    }

### Phone Log APIs

#### GET `/api/phone/:contact`

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": [
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "contact": [
                    "5c71a62d8e8bea5ba7da91d2"
                ],
                "_id": "5c8682cddf2ec1b6f7d79fb0",
                "updated_at": "2019-03-11T15:46:21.148Z",
                "created_at": "2019-03-11T15:46:21.148Z",
                "__v": 0
            },
            {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "contact": [
                    "5c71a62d8e8bea5ba7da91d2"
                ],
                "_id": "5c86832a5613b0b77f62da52",
                "updated_at": "2019-03-11T15:47:54.806Z",
                "created_at": "2019-03-11T15:47:54.806Z",
                "__v": 0
            }
        ]
    }

    ```
    HTTP Status: 401  

    ```
    {
        "status": false,
        "error": "Tag doesn`t exist"
    }
    ``` 

#### POST `/api/phone`

   Body: 
   ```
    {
        "title":"Title",
        "description": "Description",
        "location":"US",
        "due_start": "2019-02-27T14:25:58.610Z",
        "due_end": "2019-02-27T14:25:58.610Z",
        "contact":"5c71a62d8e8bea5ba7da91d2"
    }
   ```

    Response:

    HTTP Status: 200
    ```
    {
        "status": true,
        "data": {
            "user": [
                "5c715b0fccf14717986c85dc"
            ],
            "contact": [
                "5c71a62d8e8bea5ba7da91d2"
            ],
            "_id": "5c86832a5613b0b77f62da52",
            "updated_at": "2019-03-11T15:47:54.806Z",
            "created_at": "2019-03-11T15:47:54.806Z",
            "__v": 0,
            "activity": {
                "user": [
                    "5c715b0fccf14717986c85dc"
                ],
                "notes": [],
                "phone_logs": [
                    "5c86832a5613b0b77f62da52"
                ],
                "email": [],
                "contact": [
                    "5c71a62d8e8bea5ba7da91d2"
                ],
                "_id": "5c86832a5613b0b77f62da53",
                "content": "superweb3 added phone log",
                "type": "phone_logs",
                "created_at": "2019-03-11T15:47:54.826Z",
                "updated_at": "2019-03-11T15:47:54.826Z",
                "__v": 0
            }
        }
    }