"use strict";
let EURToken = artifacts.require("./EURToken.sol");
let Payroll = artifacts.require("./Payroll.sol");

module.exports = function(deployer, network, accounts) {

    return deployer.deploy(EURToken, accounts[0]).then(() => {
        return deployer.deploy(Payroll, accounts[0], EURToken.address);
    }).then(() => {

    });
};
