import {Component, OnInit, ViewChild} from '@angular/core';
import {Block} from './block.interface';
import {BlockService} from '../../interface/block.service';
import {KeyService} from '../../interface/key.service';
import {TxService} from '../../interface/tx.service';
import * as CryptoJS from 'crypto-js';
import {debounceTime} from 'rxjs/operator/debounceTime';
import {Subject} from 'rxjs/Subject';
import {Router} from '@angular/router';
import {DatatableComponent} from '@swimlane/ngx-datatable';
import {Tx} from '../../interface/tx.interface';

@Component({
  selector: 'app-mining',
  templateUrl: './mining.component.html',
  styleUrls: ['./mining.component.css']
})
export class MiningComponent implements OnInit {
  version = '02000000';
  oldBlock: Block;
  newBlock: Block;
  index = '';
  keyList;
  address = '';
  node_number = '';
  timestamp: number;
  difficultyPrefix = '0000';
  nonce = 0;
  newHash = '';
  timeout = 300; // 5 minute
  result = '';

  columns_tx = [
    {name: 'From', prop: 'from', flexGrow: 4},
    {name: 'To', prop: 'to', flexGrow: 4},
    {name: 'Amount', prop: 'amount', flexGrow: 2}
  ];
  rows_tx = [];
  txList: Tx[];

  @ViewChild(DatatableComponent) table_blocks: DatatableComponent;
  @ViewChild(DatatableComponent) table_tx: DatatableComponent;

  isCollapsed = false;
  collapseLabel = '숨기기';
  collapseArrow = 'up';
  alertMessage: string = null;
  private _alert: Subject<string>;

  // https://angular.io/guide/lifecycle-hooks#onchanges


  constructor(
    private blockService: BlockService,
    private keyService: KeyService,
    private txService: TxService,
  ) {
    this._alert = new Subject<string>();
  }

  ngOnInit() {
    this.alert('');

    this.node_number = localStorage.getItem('node_number');
    this.timestamp = Date.now();
    this.newBlock = new Block ({
      height: -1,
      node_number: this.node_number,
      address: '',
      prev_hash: '',
      merkle_root: '',
      time: this.timestamp.toString(16),
      nbits: this.difficultyPrefix,
      nonce:  (0).toString(16)
    });

    try {
      this.blockService.get_latest_block()
        .then(block => {
          this.oldBlock = block[0];
          this.newBlock.height = this.oldBlock.height + 1;
          const headerData = [
            this.version,
            this.oldBlock.prev_hash,
            this.oldBlock.merkle_root,
            this.oldBlock.time,
            this.oldBlock.nbits,
            this.oldBlock.nonce].join('');
          this.newBlock.prev_hash = CryptoJS.SHA256(headerData).toString();
          this.newBlock.merkle_root = CryptoJS.SHA256((this.oldBlock.height + 1).toString(16)).toString();
        })
        .catch(response => {
          this.alert(`errors: ${response.errors}`);
          console.log('errors: ', response.toLocaleString());
        });
    } catch (e) {
      this.alert(`Error: ${e.toLocaleString()}`);
      console.log('Error: ', e.toLocaleString());
    }

    try {
      this.keyService.get_key_node(this.node_number)
        .then(keyList => {
          this.keyList = keyList;
          this.address = keyList[0].address;
          this.newBlock.address = this.address;
          console.log('keyList: ', keyList);
          console.log('this.address: ', this.address);

          this.createTxList();
        })
        .catch(response => {
          this.alert(`errors: ${response.errors}`);
          console.log('errors: ', response.toLocaleString());
        });
    } catch (e) {
      this.alert(`Error: ${e.toLocaleString()}`);
      console.log('Error: ', e.toLocaleString());
    }
  }

  createTxList() {
    this.rows_tx = [{
      height: -1,
      hash_pointer: ' ',
      from: ' ',
      from_node: ' ',
      to: this.address,
      to_node: this.node_number,
      amount: 50,
    }];

    try {
      this.txService.get_tx_request()
        .then(tx => {
          this.rows_tx.push(...tx);
          this.rows_tx = [...this.rows_tx];
          this.txList = [...this.rows_tx];
          console.log('tx: ', tx);
          console.log('this.rows_tx: ', this.rows_tx);
        })
        .catch(response => {
          this.alert(`errors: ${response.errors}`);
          console.log('errors: ', response.errors);
        });
    } catch (e) {
      this.alert(`Error: ${e.toLocaleString()}`);
      console.log('Error: ', e.toLocaleString());
    }
  }

  updateFilterTx(event) {
    const val = event.target.value.toLowerCase();

    // filter our data
    const temp = this.txList.filter(function (d) {
      return d.from.toLowerCase().indexOf(val) !== -1 || d.to.toLowerCase().indexOf(val) !== -1 || !val;
    });

    // update the rows
    this.rows_tx = temp;
    // Whenever the filter changes, always go back to the first page
    this.table_tx.offset = 0;
  }

  validateHash(hash: string): boolean {
    return hash.indexOf(this.difficultyPrefix) === 0;
  }

  findNonce() {
    const start = Date.now();
    this.nonce = 0;
    for (let headerHash = '9999'; Date.now() - start < this.timeout * 1000 ; this.nonce++) {
      this.timestamp = Date.now();
      this.newBlock.time = this.timestamp.toString(16);
      const headerData = [
        this.version,
        this.newBlock.prev_hash,
        this.newBlock.merkle_root,
        this.newBlock.time,
        this.newBlock.nbits,
        this.nonce.toString(16)].join('');
      headerHash = CryptoJS.SHA256(headerData).toString();
      console.log(this.nonce, headerHash);
      if (this.validateHash(headerHash)) {
        this.newBlock.nonce = this.nonce.toString(16);
        this.newHash = headerHash;
        break;
      }
    }
    console.log('Elapsed Time : ', (Date.now() - start) / 1000, ' sec.');
  }

  broadcast() {
    try {
      this.blockService.create_a_block(this.newBlock)
        .then(block => {
          const resBlock: Block = block;
          this.result = `Succeed to create new block. Height number: ${resBlock.height}`;
          console.log('Succeed to create new block. Height number:', resBlock.height);
        })
        .catch(response => {
          this.alert(`errors: ${response.errors}`);
          console.log('errors: ', response.errors);
        });
    } catch (e) {
      this.alert(`Error: ${e.toLocaleString()}`);
      console.log('Error: ', e.toLocaleString());
    }
  }

  changeCoinbase(key) {
    this.address = key.address;
    this.createTxList();
  }

  reload() {
    this.ngOnInit();
    this.nonce = 0;
    this.newHash = '';
    this.result = '';
    document.body.scrollTop = document.documentElement.scrollTop = 0;
  }

  alert(msg: string) {
    this._alert.next(msg);
    this._alert.subscribe((message) => { this.alertMessage = message; });
    debounceTime.call(this._alert, 8000).subscribe(() => { this.alertMessage = null; });
  }

  collapse() {
    this.isCollapsed = !this.isCollapsed;
    if (this.isCollapsed) {
      this.collapseLabel = '보이기';
      this.collapseArrow = 'down';
    } else {
      this.collapseLabel = '숨기기';
      this.collapseArrow = 'up';
    }
  }
}
