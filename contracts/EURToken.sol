pragma solidity ^0.4.11;

import './StandardToken.sol';

contract EURToken is StandardToken {

    bool public isEURToken = false;

    string public constant name = "EUR Token";
    string public constant symbol = "EUR";
    uint256 public constant decimals = 18;

    function EURToken(address _owner) {
        isEURToken = true;
	totalSupply = 1000000000;
	balances[_owner] = totalSupply;
    }


}