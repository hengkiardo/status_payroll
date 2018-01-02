"use strict";

let EURToken = artifacts.require("./EURToken.sol");
let Payroll = artifacts.require("./Payroll.sol");
let BigNumber = require('bignumber.js');

let EURInstance, PayrollInstance;


let before_function = () => {
    return EURToken.deployed().then(function (instance) {
        EURInstance = instance;
        return Payroll.deployed();
    }).then((instance) => {
        PayrollInstance = instance;
    });
};

contract("Payroll", function (accounts) {
    before(() => {
        before_function();
    });

    it(`Should instantiate token with name EUR Token`, function () {
        return EURInstance.name.call().then(function (returnValue) {
		assert.equal(returnValue, "EUR Token");
        });
    });

    it(`Should instantiate token with symbol EUR`, function () {
        return EURInstance.symbol.call().then(function (returnValue) {
		assert.equal(returnValue, "EUR");
        });
    });

    it(`Should instantiate token with decimals set to 18`, function () {
        return EURInstance.decimals.call().then(function (returnValue) {
		assert.equal(returnValue, 18);
        });
    });
      
    it(`Should instantiate contract with employeeIds starting from 1`, function () {
        return PayrollInstance.employeeIds.call().then(function (returnValue) {
		assert.equal(returnValue, 1);
        });
    });

    it(`Should instantiate contract with oracle set to accounts[0]`, function () {
        return PayrollInstance.oracle.call().then(function (returnValue) {
		assert.equal(returnValue, accounts[0]);
        });
    });

    it(`Should instantiate contract with owner set to accounts[0]`, function () {
        return PayrollInstance.owner.call().then(function (returnValue) {
		assert.equal(returnValue, accounts[0]);
        });
    });

    it(`Should add accounts[1] as an employee`, function () {
	let expectedEmployees = 1;
	let expectedID = 1;
	let precision = new BigNumber(1000000000000000000);
	let yearlySalary = new BigNumber("240000");
	// will round down due to uint256	
	let monthlySalary = yearlySalary.mul(precision).div(12);
        return PayrollInstance.addEmployee(accounts[1], [EURInstance.address], yearlySalary).then(function (returnValue) {
		return PayrollInstance.getEmployeeCount.call();
            }).then((returnValue) => {
	    assert.equal(returnValue.valueOf(), expectedEmployees);
		return PayrollInstance.addressToId.call(accounts[1]);
            }).then((returnValue) => {
	    assert.equal(returnValue.valueOf(), expectedID);
		return PayrollInstance.employees.call(expectedID);
            }).then((result) => {
		    assert.equal(result[0].valueOf(), accounts[1]);
		    assert.equal(result[1].valueOf(), yearlySalary);
		    assert.equal(result[2].valueOf(), expectedID);
		    assert.equal(result[3].valueOf(), monthlySalary.valueOf());
        });
    });

    it(`Should set employee salary`, function () {
        let employeeID = 1;
	let precision = new BigNumber(1000000000000000000);
	let yearlySalary = new BigNumber("240000");
	let monthlySalary = yearlySalary.mul(precision).div(12);
        return PayrollInstance.setEmployeeSalary(employeeID, yearlySalary).then(function (returnValue) {
		return PayrollInstance.employees.call(employeeID);
            }).then((result) => {
	    assert.equal(result[0], accounts[1]);
	    assert.equal(result[1].valueOf(), yearlySalary.valueOf());
	    assert.equal(result[2], employeeID);
	    assert.equal(result[3].valueOf(), monthlySalary.valueOf());
        });
    });

    it(`Should add accounts[2] as an employee and then delete accounts[2]`, function () {
	let expectedEmployees = 2;
	let expectedID = 2;
	let precision = new BigNumber(1000000000000000000);
	let yearlySalary = new BigNumber("240000");
	// will round down due to uint256
	let monthlySalary = yearlySalary.mul(precision).div(12);
        return PayrollInstance.addEmployee(accounts[2], [EURInstance.address], yearlySalary).then(function (returnValue) {
		return PayrollInstance.getEmployeeCount.call();
            }).then((returnValue) => {
	    assert.equal(returnValue.valueOf(), expectedEmployees);
		return PayrollInstance.addressToId.call(accounts[2]);
            }).then((returnValue) => {
	    assert.equal(returnValue.valueOf(), expectedID);
		return PayrollInstance.employees.call(expectedID);
            }).then((result) => {
	    assert.equal(result[0], accounts[2]);
	    assert.equal(result[1].valueOf(), yearlySalary.valueOf());
	    assert.equal(result[2], expectedID);
	    assert.equal(result[3].valueOf(), monthlySalary.valueOf());
		return PayrollInstance.removeEmployee(expectedID);
            }).then((result) => {
		return PayrollInstance.addressToId.call(expectedID);
            }).then((returnValue) => {
		assert.equal(returnValue.valueOf(), 0);
        });
    });

    it(`Should transfer an amount of tokens to Payroll contract`, function () {
	let precision = new BigNumber(1000000000000000000);
	let amt = new BigNumber("100000").mul(precision);
        return EURInstance.transfer(PayrollInstance.address, amt).then(function (returnValue) {
		return EURInstance.balanceOf.call(PayrollInstance.address);
            }).then((returnValue) => {
	    assert.equal(returnValue.valueOf(), amt);
        });
    });


    it(`Should calculate payroll runway based on current balance`, function () {
	    // 5 months
        let expectedDays = 150;
        return PayrollInstance.calculatePayrollRunway.call().then(function (returnValue) {
    	    assert.equal(returnValue.valueOf(), expectedDays);
        });
    });

    it(`Should determine allocation of salary tokens`, function () {
        let exchangeRate = 10 ** 18;
	let precision = new BigNumber(1000000000000000000);
        return PayrollInstance.determineAllocation([EURInstance.address], [100], {from:accounts[1]}).then(function (returnValue) {
		return PayrollInstance.setExchangeRate(EURInstance.address, exchangeRate);
            }).then((returnValue) => {
		return PayrollInstance.exchangeRates(EURInstance.address);
            }).then((returnValue) => {
		assert.equal(returnValue.valueOf(), exchangeRate);
		// time travel
		let time_delta = 31 * 60 * 60 * 24;                                                                                                           
		web3.currentProvider.send({jsonrpc: "2.0", method: "evm_increaseTime", params: [time_delta], id: 0});                                   
		web3.currentProvider.send({jsonrpc: "2.0", method: "evm_mine", params: [], id: 0});  
		return PayrollInstance.payday({from:accounts[1]});
	    }).then((returnValue) => {
		return EURInstance.balanceOf.call(accounts[1]);
		}).then((returnValue) => {
		assert.equal(returnValue.valueOf(), 20000 * precision);
        });
    });

    it(`Should transfer an balance to accounts[0]`, function () {
        let amt = 0;
        return PayrollInstance.scapeHatch().then(function (returnValue) {
		return EURInstance.balanceOf.call(PayrollInstance.address);
            }).then((returnValue) => {
	    assert.equal(returnValue.valueOf(), amt);
        });
    });

});
