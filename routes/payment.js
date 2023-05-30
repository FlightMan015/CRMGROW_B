const express = require('express');

const UserCtrl = require('../controllers/user');
const PaymentCtrl = require('../controllers/payment');
const { catchError } = require('../controllers/error');

const router = express.Router();

router.post('/', UserCtrl.checkAuth, catchError(PaymentCtrl.update));
router.get(
  '/transactions',
  UserCtrl.checkAuth,
  catchError(PaymentCtrl.getTransactions)
);
router.post('/failed', catchError(PaymentCtrl.paymentFailed));
router.post('/succeed', catchError(PaymentCtrl.paymentSucceed));
router.get('/:id', UserCtrl.checkAuth, catchError(PaymentCtrl.get));

module.exports = router;
