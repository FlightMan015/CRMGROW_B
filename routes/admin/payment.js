const express = require('express');

const UserCtrl = require('../../controllers/admin/user');
const PaymentCtrl = require('../../controllers/admin/payment');
const { catchError } = require('../../controllers/error');

const router = express.Router();

router.get(
  '/pages/:id',
  UserCtrl.checkAuth,
  catchError(PaymentCtrl.getCustomers)
);
router.get(
  '/transactions/:id',
  UserCtrl.checkAuth,
  catchError(PaymentCtrl.getTransactions)
);
router.get('/refund', UserCtrl.checkAuth, catchError(PaymentCtrl.refundCharge));
router.get(
  '/coming-invoice/:id',
  UserCtrl.checkAuth,
  catchError(PaymentCtrl.getUpcomingInvoice)
);
router.get('/cards/:id', UserCtrl.checkAuth, catchError(PaymentCtrl.getCards));
router.post('/card', UserCtrl.checkAuth, catchError(PaymentCtrl.getCard));
router.get('/:id', UserCtrl.checkAuth, catchError(PaymentCtrl.getCustomer));
module.exports = router;
