// Intentionally fictional fixtures. Never used in a live scan or as live offers.
(function (root) {
function demoData() {
  const offer = CartCore.parseOffer('10% instant discount on SBI Credit Cards up to ₹1,500, minimum transaction ₹2,490. Check card exclusions and checkout eligibility.');
  const original = [
    {asin:'DEMO000001', title:'Soundleaf wireless over-ear headphones with active noise cancellation',price:4499,quantity:1,image:''},
    {asin:'DEMO000002', title:'Voltline 65W USB-C fast charger with dual ports',price:2999,quantity:1,image:''},
    {asin:'DEMO000003', title:'Timeleaf smartwatch with AMOLED display and fitness tracking',price:5499,quantity:1,image:''}
  ];
  const products = [
    [{asin:'DEMO000011',title:'Soundleaf wireless over-ear headphones with hybrid active noise cancellation',price:4299,image:'',offers:[offer],offer}, {asin:'DEMO000012',title:'Audiofield wireless over-ear headphones with active noise cancellation',price:3999,image:'',offer:{status:'unknown',text:'',modes:[]}}],
    [{asin:'DEMO000021',title:'Voltline 65W USB-C fast charger with dual ports, compact design',price:2799,image:'',offers:[offer],offer}],
    [{asin:'DEMO000031',title:'Timeleaf smartwatch with AMOLED display and fitness tracking, new design',price:5299,image:'',offer:{status:'mentioned',text:'SBI card payment options available. Expand Bank Offers on Amazon to inspect the details.',modes:[]}}]
  ];
  return {items:original,results:original.map((item,i)=>({original:item,candidates:products[i],state:'complete',error:null})),scannedAt:new Date().toISOString()};
}
root.CartwiseDemo = {demoData};
})(globalThis);
