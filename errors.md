Console Error


Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.
app/delivery/history/page.tsx (118:25) @ <unknown>


  116 |                 ) : (
  117 |                     filteredOrders.map(order => (
> 118 |                         <Card key={order.id} className="bg-gray-900 border-gray-800 text-white hover:border-gray-700 transition-all hover:bg-gray-900/80 group">
      |                         ^
  119 |                             <CardContent className="p-5">
  120 |                                 <div className="flex flex-col md:flex-row gap-5 items-center">
  121 |                                     {/* Date Box */}


and 

Console Error


Encountered two children with the same key, ``. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.
app/delivery/history/page.tsx (118:25) @ <unknown>


  116 |                 ) : (
  117 |                     filteredOrders.map(order => (
> 118 |                         <Card key={order.id} className="bg-gray-900 border-gray-800 text-white hover:border-gray-700 transition-all hover:bg-gray-900/80 group">
      |                         ^
  119 |                             <CardContent className="p-5">
  120 |                                 <div className="flex flex-col md:flex-row gap-5 items-center">
  121 |                                     {/* Date Box */}


and 

Runtime Error


Objects are not valid as a React child (found: object with keys {id, updatedAt, state, type, city, isDefault, plusCode, street, pincode, country}). If you meant to render a collection of children, use an array instead.
