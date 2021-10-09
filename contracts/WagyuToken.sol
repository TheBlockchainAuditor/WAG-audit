// SPDX-License-Identifier: MIT
pragma solidity ^0.6.2;

import "./LGEWhitelisted.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/SafeCast.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Address.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";

import "hardhat/console.sol";

contract WAG is IERC20, OwnableUpgradeSafe, LGEWhitelisted {
    
    using SafeMath for uint256;
    using Address for address;

    mapping (address => uint256) private _balances;

    mapping (address => mapping (address => uint256)) private _allowances;

    uint256 private _totalSupply;

    string private _name;
    string private _symbol;
    uint8 private _decimals;
    
    mapping(address => bool) public _feeExcluded;

	uint256 public _feeRewardPct;
	
	address public _feeRewardAddress;

	mapping(address => bool) public _pair;
	
	address public _router;
    
    function initialize(uint256 feeRewardPct, address feeRewardAddress, address router)
        public
        initializer
    {
        
        _name = "WAGYUSWAP.app";
        _symbol = "WAG";
        _decimals = 18;
        
        __Ownable_init();
		__LGEWhitelisted_init();
		
		_mint(_msgSender(), 500000000e18);
		
		setFees(feeRewardPct, feeRewardAddress);
		
		_router = router;
		
		setFeeExcluded(_msgSender(), true);
		setFeeExcluded(address(this), true);
    }

    function setRouter(address r) public onlyOwner {
        _router = r;
    }
    
    function setFees(uint256 feeRewardPct, address feeRewardAddress) public onlyOwner {
        require(feeRewardPct <= 2000, "Fees must not equal more than 20%");
		require(feeRewardAddress != address(0), "Fee reward address must not be zero address");
		
		_feeRewardPct = feeRewardPct;
		_feeRewardAddress = feeRewardAddress;
		
    }

	function setPair(address a, bool pair) public onlyOwner {
        _pair[a] = pair;
    }

	function setFeeExcluded(address a, bool excluded) public onlyOwner {
        _feeExcluded[a] = excluded;
    }
    
    function _beforeTokenTransfer(address sender, address recipient, uint256 amount) internal {
		LGEWhitelisted._applyLGEWhitelist(sender, recipient, amount);
    }
	
	function _transfer(address sender, address recipient, uint256 amount) internal {
        require(sender != address(0), "ERC20: transfer from the zero address");
        require(recipient != address(0), "ERC20: transfer to the zero address");
		
        _beforeTokenTransfer(sender, recipient, amount);
		
		_balances[sender] = _balances[sender].sub(amount, "ERC20: transfer amount exceeds balance");
		
        // console.log(recipient);
        // console.log("sender", sender);
        // console.log(_pair[recipient]);
        // console.log(!_feeExcluded[sender]);

		if(_pair[recipient] && !_feeExcluded[sender]) {
			
			uint256 feeRewardAmount = 0;
			
			if(_feeRewardPct > 0 && _feeRewardAddress != address(0))  {
			    
				feeRewardAmount = amount.mul(_feeRewardPct).div(10000);
				
				if(_router != address(0)) {
				    
    				_balances[address(this)] = _balances[address(this)].add(feeRewardAmount);
    				
    				emit Transfer(sender, address(this), feeRewardAmount);
    				
    				IUniswapV2Router02 r = IUniswapV2Router02(_router);
    				
    				address[] memory path = new address[](2);
            
                    path[0] = address(this);
                    path[1] = r.WETH();
                    
                    _approve(address(this), _router, feeRewardAmount);
    
                    r.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                        feeRewardAmount,
                        0,
                        path,
                        _feeRewardAddress,
                        block.timestamp
                    );
                
				} else {
				    _balances[_feeRewardAddress] = _balances[_feeRewardAddress].add(feeRewardAmount);
				    emit Transfer(sender, _feeRewardAddress, feeRewardAmount);
				}
				
			}
			// console.log("checking fee", feeRewardAmount == 1000E18);
			amount = amount.sub(feeRewardAmount);
            // console.log("checking amount", amount == 9000E18);
			
		}
        _balances[recipient] = _balances[recipient].add(amount);
        // console.log("checking amount", amount == 9000E18);
        // console.log(_balances[recipient] == 109000E18);
        emit Transfer(sender, recipient, amount);
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view override returns (uint256) {
        return _balances[account];
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(_msgSender(), recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(_msgSender(), spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(sender, recipient, amount);
        _approve(sender, _msgSender(), _allowances[sender][_msgSender()].sub(amount, "ERC20: transfer amount exceeds allowance"));
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        _approve(_msgSender(), spender, _allowances[_msgSender()][spender].add(addedValue));
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        _approve(_msgSender(), spender, _allowances[_msgSender()][spender].sub(subtractedValue, "ERC20: decreased allowance below zero"));
        return true;
    }

    // // Helper function to access _burn function
    // function burn(uint256 amount) public virtual returns (bool) {
    //     _burn(_msgSender(), amount);
    //     return true;
    // }

    function _mint(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: mint to the zero address");

        _beforeTokenTransfer(address(0), account, amount);

        _totalSupply = _totalSupply.add(amount);
        _balances[account] = _balances[account].add(amount);
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        require(account != address(0), "ERC20: burn from the zero address");

        _beforeTokenTransfer(account, address(0), amount);

        _balances[account] = _balances[account].sub(amount, "ERC20: burn amount exceeds balance");
        _totalSupply = _totalSupply.sub(amount);
        emit Transfer(account, address(0), amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
	
}